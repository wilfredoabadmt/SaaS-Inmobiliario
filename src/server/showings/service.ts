import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { member } from "@/lib/db/schema/auth";
import { candidacy, conversation, property, showing } from "@/lib/db/schema/domain";
import { findSlot } from "@/server/calendar/availability";
import { getSettings } from "@/server/calendar/settings";
import { syncShowingToGoogle } from "@/server/calendar/google";
import { notifyShowing } from "@/server/calendar/notify";
import { advanceStageForward, resolveAnchorStage } from "@/server/pipeline/stages";

/** Resultado de mutación de visita (para mapear códigos en endpoints/agente). */
export type ShowingMutationResult =
  | { ok: true; showingId: string }
  | { ok: false; code: "not_found" | "slot_taken" };

/** Resuelve un asesor para asignar la visita: el de la conversación o, si no, un owner/miembro del tenant. */
export async function resolveAgentId(
  organizationId: string,
  assignedAgentId: string | null,
): Promise<string | null> {
  if (assignedAgentId) return assignedAgentId;
  const rows = await getDb()
    .select({ userId: member.userId, role: member.role })
    .from(member)
    .where(eq(member.organizationId, organizationId));
  const owner = rows.find((r) => r.role === "owner");
  return owner?.userId ?? rows[0]?.userId ?? null;
}

/**
 * Asegura una candidatura (cliente↔propiedad) y devuelve su id (para enlazar la visita).
 * Regla de avance + promoción (feature 010, DV-SP-6/DV-SP-8): si ya hay trato para esa propiedad
 * lo **avanza** (no retrocede) al ancla `visit`; si el cliente solo tenía un trato sin-propiedad
 * (auto-alta por inbound) lo **promueve** (le asocia la propiedad) en vez de duplicar; si no hay
 * ninguno, crea uno en el ancla `visit`.
 */
async function ensureCandidacy(
  organizationId: string,
  clientId: string,
  propertyId: string,
): Promise<string> {
  const db = getDb();
  const visitStageId = await resolveAnchorStage(organizationId, "visit");

  const [existing] = await db
    .select({ id: candidacy.id })
    .from(candidacy)
    .where(
      and(
        eq(candidacy.organizationId, organizationId),
        eq(candidacy.clientId, clientId),
        eq(candidacy.propertyId, propertyId),
      ),
    )
    .limit(1);
  if (existing) {
    await advanceStageForward(organizationId, existing.id, visitStageId);
    return existing.id;
  }

  const [noProp] = await db
    .select({ id: candidacy.id })
    .from(candidacy)
    .where(
      and(
        eq(candidacy.organizationId, organizationId),
        eq(candidacy.clientId, clientId),
        isNull(candidacy.propertyId),
      ),
    )
    .limit(1);
  if (noProp) {
    await db
      .update(candidacy)
      .set({ propertyId, updatedAt: new Date() })
      .where(and(eq(candidacy.id, noProp.id), eq(candidacy.organizationId, organizationId)));
    await advanceStageForward(organizationId, noProp.id, visitStageId);
    return noProp.id;
  }

  const id = newId("candidacy");
  await db
    .insert(candidacy)
    .values({ id, organizationId, clientId, propertyId, stageId: visitStageId })
    .onConflictDoNothing({ target: [candidacy.organizationId, candidacy.clientId, candidacy.propertyId] });
  const [row] = await db
    .select({ id: candidacy.id })
    .from(candidacy)
    .where(
      and(
        eq(candidacy.organizationId, organizationId),
        eq(candidacy.clientId, clientId),
        eq(candidacy.propertyId, propertyId),
      ),
    )
    .limit(1);
  return row?.id ?? id;
}

/**
 * Crea una visita a partir de la acción del agente (US4). Valida que la propiedad
 * sea del tenant y enlaza la candidatura (cliente↔propiedad) para que aparezca con
 * el cliente en la vista de Visitas. Devuelve el id o null si no se pudo.
 */
export async function createShowingFromAgent(
  organizationId: string,
  conversationId: string,
  propertyId: string,
  whenISO: string,
): Promise<string | null> {
  const db = getDb();

  const convRows = await db
    .select({ clientId: conversation.clientId, assignedAgentId: conversation.assignedAgentId })
    .from(conversation)
    .where(and(eq(conversation.id, conversationId), eq(conversation.organizationId, organizationId)))
    .limit(1);
  const conv = convRows[0];
  if (!conv) return null;

  const propRows = await db
    .select({ id: property.id })
    .from(property)
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .limit(1);
  if (!propRows[0]) return null;

  const scheduledAt = new Date(whenISO);
  if (Number.isNaN(scheduledAt.getTime())) return null;

  const agentId = await resolveAgentId(organizationId, conv.assignedAgentId);
  if (!agentId) return null;

  // Re-check de disponibilidad (DV-VS-4): si el slot se ocupó entre la propuesta y la
  // confirmación, no se agenda (el agente ofrecerá alternativas). Sin esto habría doble-booking.
  const slot = await findSlot(organizationId, agentId, scheduledAt.toISOString());
  if (!slot) return null;

  const settings = await getSettings(organizationId, agentId);
  const candidacyId = await ensureCandidacy(organizationId, conv.clientId, propertyId);

  const id = newId("showing");
  await db.insert(showing).values({
    id,
    organizationId,
    propertyId,
    candidacyId,
    agentId,
    scheduledAt,
    durationMinutes: settings.slotMinutes,
    remindAt: new Date(scheduledAt.getTime() - 24 * 3_600_000),
    status: "agendada",
  });
  await afterShowingMutation("created", organizationId, id);
  return id;
}

/**
 * Reprograma una visita existente a otro slot disponible (US2). Valida pertenencia al tenant y
 * que el nuevo `whenISO` esté libre (excluyendo la propia visita). Sincroniza Google + email vía
 * `afterShowingMutation`.
 */
export async function rescheduleShowing(
  organizationId: string,
  showingId: string,
  whenISO: string,
): Promise<ShowingMutationResult> {
  const db = getDb();
  const [row] = await db
    .select({ id: showing.id, agentId: showing.agentId, status: showing.status })
    .from(showing)
    .where(and(eq(showing.id, showingId), eq(showing.organizationId, organizationId)))
    .limit(1);
  if (!row || row.status === "cancelada") return { ok: false, code: "not_found" };

  const when = new Date(whenISO);
  if (Number.isNaN(when.getTime())) return { ok: false, code: "slot_taken" };
  const slot = await findSlot(organizationId, row.agentId, when.toISOString(), {
    excludeShowingId: showingId,
  });
  if (!slot) return { ok: false, code: "slot_taken" };

  const settings = await getSettings(organizationId, row.agentId);
  await db
    .update(showing)
    .set({
      scheduledAt: when,
      durationMinutes: settings.slotMinutes,
      remindAt: new Date(when.getTime() - 24 * 3_600_000),
      reminderEmailSentAt: null,
      status: "agendada",
      updatedAt: new Date(),
    })
    .where(and(eq(showing.id, showingId), eq(showing.organizationId, organizationId)));
  await afterShowingMutation("rescheduled", organizationId, showingId);
  return { ok: true, showingId };
}

/** Cancela una visita (US2). Sincroniza Google (borra evento) + email vía `afterShowingMutation`. */
export async function cancelShowing(
  organizationId: string,
  showingId: string,
): Promise<ShowingMutationResult> {
  const db = getDb();
  const [row] = await db
    .select({ id: showing.id, status: showing.status })
    .from(showing)
    .where(and(eq(showing.id, showingId), eq(showing.organizationId, organizationId)))
    .limit(1);
  if (!row) return { ok: false, code: "not_found" };
  if (row.status === "cancelada") return { ok: true, showingId };

  await db
    .update(showing)
    .set({ status: "cancelada", updatedAt: new Date() })
    .where(and(eq(showing.id, showingId), eq(showing.organizationId, organizationId)));
  await afterShowingMutation("cancelled", organizationId, showingId);
  return { ok: true, showingId };
}

/**
 * Efectos secundarios best-effort tras crear/reprogramar/cancelar una visita: sincronizar el
 * evento de Google (US4) y notificar por email al asesor (US3). NUNCA lanza: un fallo aquí no
 * debe tumbar la operación de Inmox (DV-VS-11/FR-017). Las integraciones se enganchan en sus
 * features; aquí solo se orquesta.
 */
async function afterShowingMutation(
  kind: "created" | "rescheduled" | "cancelled",
  organizationId: string,
  showingId: string,
): Promise<void> {
  // US4 (Google): sincroniza el evento ANTES de notificar (para que el email refleje el estado).
  try {
    await syncShowingToGoogle(kind, organizationId, showingId);
  } catch (e) {
    console.error("[showing] sync Google falló:", e instanceof Error ? e.message : String(e));
  }
  // US3 (email): notifica al asesor (best-effort, no lanza).
  const mailKind = kind === "created" ? "confirmation" : kind === "rescheduled" ? "reschedule" : "cancellation";
  await notifyShowing(mailKind, showingId);
}
