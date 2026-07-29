import { and, eq, inArray } from "drizzle-orm";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import {
  client,
  clientRequirements,
  conversation,
  conversationProperty,
  message,
} from "@/lib/db/schema/domain";
import { clearMatchCache } from "@/server/matching/engine";

export const dynamic = "force-dynamic";

/**
 * DEV — resetea conversaciones del tenant para volver a probar el agente desde cero:
 * borra el historial de mensajes, los requisitos del cliente (vacía el panel de matching),
 * los vínculos conversación↔propiedad (incluida la propiedad de interés) y deja la
 * conversación lista: sin handoff (`needs_human=false`) y con el agente ACTIVO
 * (`ai_enabled=true`, para no tener que re-activarlo a mano). Limpia además la caché en
 * memoria del matching. Solo owner. NO borra la conversación ni el cliente (preserva el
 * mapeo del número de prueba y el opt-in del agente).
 *
 * Body opcional `{ phone?: string }`: acota a la(s) conversación(es) cuyo teléfono del
 * cliente termina con esos dígitos; sin body, resetea TODAS las del tenant.
 */
export async function POST(req: Request) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  // Filtro opcional por sufijo de teléfono.
  let suffix: string | null = null;
  try {
    const body = (await req.json()) as { phone?: unknown };
    if (typeof body?.phone === "string" && body.phone.trim()) {
      suffix = body.phone.replace(/\D/g, "");
    }
  } catch {
    /* sin body: resetea todas */
  }

  const db = getDb();

  const rows = await db
    .select({
      conversationId: conversation.id,
      clientId: conversation.clientId,
      phone: client.phone,
    })
    .from(conversation)
    .innerJoin(client, eq(client.id, conversation.clientId))
    .where(eq(conversation.organizationId, organizationId));

  const targets = suffix
    ? rows.filter((r) => r.phone.replace(/\D/g, "").endsWith(suffix))
    : rows;

  if (targets.length === 0) {
    return Response.json({ reset: 0, message: "Sin conversaciones que resetear." });
  }

  const convIds = [...new Set(targets.map((t) => t.conversationId))];
  const clientIds = [...new Set(targets.map((t) => t.clientId))];

  // 1) Historial de mensajes.
  const delMsgs = await db
    .delete(message)
    .where(and(eq(message.organizationId, organizationId), inArray(message.conversationId, convIds)))
    .returning({ id: message.id });

  // 2) Vínculos conversación↔propiedad (incluye la propiedad de interés / principal).
  await db
    .delete(conversationProperty)
    .where(
      and(
        eq(conversationProperty.organizationId, organizationId),
        inArray(conversationProperty.conversationId, convIds),
      ),
    );

  // 3) Requisitos del cliente (vacía el panel de matching; re-califica desde cero).
  await db
    .delete(clientRequirements)
    .where(
      and(
        eq(clientRequirements.organizationId, organizationId),
        inArray(clientRequirements.clientId, clientIds),
      ),
    );

  // 4) Deja la conversación lista para probar: sin handoff + agente ACTIVO.
  await db
    .update(conversation)
    .set({ needsHuman: false, needsHumanReason: null, aiEnabled: true, lastMessageAt: null })
    .where(and(eq(conversation.organizationId, organizationId), inArray(conversation.id, convIds)));

  // 5) Caché en memoria del matching (por si se resetea sin redeploy).
  clearMatchCache();

  return Response.json({
    reset: convIds.length,
    deletedMessages: delMsgs.length,
    aiEnabled: true,
    needsHumanCleared: true,
    message: "Reseteado: historial vacío, requisitos limpios, agente activo.",
  });
}
