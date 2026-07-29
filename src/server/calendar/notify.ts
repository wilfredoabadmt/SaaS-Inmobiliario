import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { candidacy, client, conversation, property, showing } from "@/lib/db/schema/domain";
import { getEnv } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { renderShowingMail, type MailKind } from "@/lib/mail/templates";
import { labelInTz } from "@/lib/time/slots";
import { getSettings } from "@/server/calendar/settings";

/**
 * Notificaciones por email al asesor (feature 011, US3). Best-effort: si no hay email del asesor
 * o el SMTP está OFF, no hace nada (no lanza). El agendado nunca se cae por email (FR-017).
 */

interface LoadedShowing {
  organizationId: string;
  agentEmail: string | null;
  agentTz: string;
  clientName: string;
  propertyTitle: string;
  scheduledAt: Date;
  clientId: string;
  agentId: string;
}

async function loadShowing(showingId: string): Promise<LoadedShowing | null> {
  const [row] = await getDb()
    .select({
      organizationId: showing.organizationId,
      scheduledAt: showing.scheduledAt,
      agentId: showing.agentId,
      agentEmail: user.email,
      clientId: candidacy.clientId,
      clientName: client.name,
      propertyTitle: property.title,
    })
    .from(showing)
    .leftJoin(user, eq(showing.agentId, user.id))
    .innerJoin(property, eq(showing.propertyId, property.id))
    .leftJoin(candidacy, eq(showing.candidacyId, candidacy.id))
    .leftJoin(client, eq(candidacy.clientId, client.id))
    .where(eq(showing.id, showingId))
    .limit(1);
  if (!row) return null;
  const settings = await getSettings(row.organizationId, row.agentId);
  return {
    organizationId: row.organizationId,
    agentEmail: row.agentEmail ?? null,
    agentTz: settings.timezone,
    clientName: row.clientName ?? "Cliente de WhatsApp",
    propertyTitle: row.propertyTitle ?? "Propiedad",
    scheduledAt: row.scheduledAt,
    clientId: row.clientId ?? "",
    agentId: row.agentId,
  };
}

/** Deep-link a la conversación del cliente en la bandeja (o null). */
async function inboxUrlForClient(organizationId: string, clientId: string): Promise<string | null> {
  if (!clientId) return null;
  const [conv] = await getDb()
    .select({ id: conversation.id })
    .from(conversation)
    .where(and(eq(conversation.organizationId, organizationId), eq(conversation.clientId, clientId)))
    .limit(1);
  if (!conv) return null;
  const base = getEnv().APP_BASE_URL.replace(/\/$/, "");
  return `${base}/inbox?c=${conv.id}`;
}

/** Envía el email del asesor para un evento de visita. Devuelve true si se envió. */
export async function sendShowingEmail(kind: MailKind, showingId: string): Promise<boolean> {
  const data = await loadShowing(showingId);
  if (!data || !data.agentEmail) return false;
  const inboxUrl = await inboxUrlForClient(data.organizationId, data.clientId);
  const mail = renderShowingMail({
    kind,
    clientName: data.clientName,
    propertyTitle: data.propertyTitle,
    whenLabel: labelInTz(data.scheduledAt.toISOString(), data.agentTz),
    inboxUrl,
  });
  return sendMail({ to: data.agentEmail, ...mail });
}

/** Notifica al asesor de un cambio en una visita (best-effort, no lanza). */
export async function notifyShowing(kind: MailKind, showingId: string): Promise<void> {
  try {
    await sendShowingEmail(kind, showingId);
  } catch (e) {
    console.error("[notify] fallo:", e instanceof Error ? e.message : String(e));
  }
}
