import { after } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { candidacy, client, conversation, message } from "@/lib/db/schema/domain";
import type { WhatsAppChangeValue } from "@/lib/meta";
import { scheduleAgentRun } from "@/server/ai/coalesce";
import { handleButtonReply } from "@/server/inbox/buttons";
import { getOrCreateConversation } from "@/server/inbox/conversations";
import { sendAgentAskForText } from "@/server/inbox/send";
import { resolveInitialStage } from "@/server/pipeline/stages";

/**
 * Procesa un `value` del webhook de WhatsApp de forma **idempotente** (Principio IV /
 * FR-005). La dedup la garantiza el UNIQUE en `message.wa_message_id` +
 * `onConflictDoNothing`: recibir el mismo evento dos veces no duplica mensajes.
 */
export async function processWebhookValue(
  organizationId: string,
  value: WhatsAppChangeValue,
): Promise<void> {
  const db = getDb();

  // Estados de mensajes salientes (delivered/read/failed).
  for (const status of value.statuses ?? []) {
    await db
      .update(message)
      .set({ status: status.status })
      .where(and(eq(message.organizationId, organizationId), eq(message.waMessageId, status.id)));
  }

  // Mensajes entrantes.
  const contactName = value.contacts?.[0]?.profile?.name ?? null;
  for (const msg of value.messages ?? []) {
    const clientId = await getOrCreateClient(organizationId, msg.from, contactName);
    const conv = await getOrCreateConversation(organizationId, clientId, msg.from);
    const waTimestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();

    // Tap de un botón interactivo de la ficha (feature 006): button_reply.{id,title}.
    const buttonReplyId = msg.interactive?.button_reply?.id ?? null;
    const buttonReplyTitle =
      msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null;

    // `returning` solo trae fila si el insert fue NUEVO (no un reintento) — base de la
    // idempotencia del disparo del agente y del ruteo de botones (Principio IV / FR-009/011).
    const inserted = await db
      .insert(message)
      .values({
        id: newId("message"),
        organizationId,
        conversationId: conv.id,
        waMessageId: msg.id,
        direction: "inbound",
        waType: msg.type ?? null,
        body: msg.text?.body ?? buttonReplyTitle ?? null,
        waTimestamp,
      })
      .onConflictDoNothing({ target: message.waMessageId })
      .returning({ id: message.id });
    const isNew = inserted.length > 0;

    await db
      .update(conversation)
      .set({ lastMessageAt: waTimestamp })
      .where(eq(conversation.id, conv.id));

    if (!isNew) continue; // reintento del webhook → no re-procesar (idempotencia)

    // Auto-alta en el pipeline (feature 010, DV-SP-6): el contacto entra al embudo en la etapa
    // inicial si aún no tiene ningún trato. Corre tras responder 200 a Meta (after), idempotente.
    after(() => ensureClientInPipeline(organizationId, clientId));

    // Tap de botón de la ficha: acción DETERMINISTA, corre con o sin agente activo (FR-012).
    // Corre DESPUÉS de responder 200 a Meta (after) para no agotar el webhook.
    if (msg.type === "interactive" && buttonReplyId) {
      after(() =>
        handleButtonReply(organizationId, { id: conv.id, waContactPhone: msg.from }, buttonReplyId),
      );
      continue;
    }

    // Disparo del agente (solo con agente activo y sin handoff).
    if (conv.aiEnabled && !conv.needsHuman) {
      if (msg.type === "text" && msg.text?.body?.trim()) {
        // Texto: coalescencia de ráfaga → una sola respuesta del agente (RB-3).
        after(() => scheduleAgentRun(organizationId, conv.id));
      } else {
        // No-texto (audio/imagen/ubicación/…): el agente no lo interpreta (RB-2).
        after(() => handleNonTextInbound(organizationId, conv.id, msg.from));
      }
    }
  }
}

/**
 * Maneja un entrante NO textual (feature 005, RB-2/FR-004/005). El agente no interpreta
 * audio/imagen/ubicación: pide texto y sigue activo; si el cliente **insiste** (el
 * entrante anterior también fue no-texto) cede a humano con motivo `uninterpretable`.
 * Degrada con gracia (no rompe el webhook ni reporta envíos inexistentes).
 */
async function handleNonTextInbound(
  organizationId: string,
  conversationId: string,
  waContactPhone: string,
): Promise<void> {
  try {
    const db = getDb();
    // Últimos 2 entrantes: [0] = el actual (recién insertado), [1] = el anterior.
    const lastTwo = await db
      .select({ waType: message.waType })
      .from(message)
      .where(and(eq(message.conversationId, conversationId), eq(message.direction, "inbound")))
      .orderBy(desc(message.createdAt))
      .limit(2);
    const previous = lastTwo[1];
    const insists = previous != null && previous.waType != null && previous.waType !== "text";

    if (insists) {
      await db
        .update(conversation)
        .set({ needsHuman: true, needsHumanReason: "uninterpretable" })
        .where(eq(conversation.id, conversationId));
      return;
    }
    // Primer no-texto: pide texto y mantiene el agente activo (FR-004/FR-007).
    await sendAgentAskForText(organizationId, { id: conversationId, waContactPhone });
  } catch (e) {
    console.error(
      `[ingest] fallo manejando no-texto en ${conversationId}:`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Auto-alta + enriquecimiento del contacto desde un entrante (feature 009, DV-CM-4).
 * - Inserta con `channel='whatsapp'` (canal de origen).
 * - Si ya existe (por `org+phone`): completa el nombre SOLO si estaba vacío (`COALESCE`,
 *   no pisa lo editado a mano) y sube el canal de `'manual'` al real (canal de origen =
 *   primer toque real). Idempotente: reejecutar el mismo evento no cambia el resultado.
 */
async function getOrCreateClient(
  organizationId: string,
  phone: string,
  name: string | null,
): Promise<string> {
  const db = getDb();
  await db
    .insert(client)
    .values({ id: newId("client"), organizationId, phone, name, channel: "whatsapp" })
    .onConflictDoUpdate({
      target: [client.organizationId, client.phone],
      set: {
        name: sql`coalesce(${client.name}, ${name ?? null})`,
        channel: sql`case when ${client.channel} = 'manual' then 'whatsapp' else ${client.channel} end`,
        // Reactiva un contacto archivado al volver a escribir (feature 009): reaparece con
        // su historial. Idempotente (poner null repetido no cambia el resultado).
        archivedAt: null,
        updatedAt: new Date(),
      },
    });
  const rows = await db
    .select({ id: client.id })
    .from(client)
    .where(and(eq(client.organizationId, organizationId), eq(client.phone, phone)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("No se pudo resolver el cliente tras el upsert");
  return row.id;
}

/**
 * Auto-alta del contacto en el pipeline (feature 010, DV-SP-6): si el cliente aún no tiene
 * ningún trato, crea uno SIN propiedad en la etapa inicial → todo inbound aparece en el embudo.
 * Idempotente: el unique parcial `(org, client) WHERE property_id IS NULL` + `onConflictDoNothing`
 * evita duplicar la tarjeta ante reintentos/ráfagas. Degrada con gracia (no rompe el webhook).
 */
async function ensureClientInPipeline(organizationId: string, clientId: string): Promise<void> {
  try {
    const db = getDb();
    const existing = await db
      .select({ id: candidacy.id })
      .from(candidacy)
      .where(and(eq(candidacy.organizationId, organizationId), eq(candidacy.clientId, clientId)))
      .limit(1);
    if (existing.length > 0) return;

    const stageId = await resolveInitialStage(organizationId);
    await db
      .insert(candidacy)
      .values({ id: newId("candidacy"), organizationId, clientId, propertyId: null, stageId })
      .onConflictDoNothing({
        target: [candidacy.organizationId, candidacy.clientId],
        where: sql`${candidacy.propertyId} is null`,
      });
  } catch (e) {
    console.error(
      `[ingest] no se pudo auto-crear el trato del cliente ${clientId}:`,
      e instanceof Error ? e.message : String(e),
    );
  }
}
