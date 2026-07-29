import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { instagramDm } from "@/lib/db/schema/domain";
import { igGraphRequest } from "@/lib/instagram";

/**
 * Mensajería directa de Instagram (feature 008, US4). Lectura de hilos en vivo (Graph) +
 * un log mínimo (`instagram_dm`) para la ventana de 24 h y la idempotencia del webhook.
 */

export const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Lógica PURA de la ventana de 24 h (testeable sin BD). */
export function isWithinWindow(lastInboundAt: Date | null, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() <= WINDOW_MS;
}

export interface IgThreadMessage {
  id: string;
  from?: { id: string; username?: string };
  message?: string;
  created_time?: string;
}

export interface IgThread {
  id: string;
  updated_time?: string;
  participants?: { data?: Array<{ id: string; username?: string }> };
  messages?: { data?: IgThreadMessage[] };
}

/** Hilos de conversación en vivo desde Graph. */
export async function listConversations(token: string, igUserId: string): Promise<IgThread[]> {
  const res = await igGraphRequest<{ data?: IgThread[] }>(`${igUserId}/conversations`, {
    method: "GET",
    token,
    searchParams: {
      platform: "instagram",
      fields: "participants,updated_time,messages{id,from,message,created_time}",
    },
  });
  return res.data ?? [];
}

/** Envía un DM (JSON `{recipient,message}`). El caller ya validó la ventana de 24 h. */
export async function sendDm(
  token: string,
  igUserId: string,
  recipientIgsid: string,
  text: string,
): Promise<void> {
  await igGraphRequest(`${igUserId}/messages`, {
    method: "POST",
    token,
    body: { recipient: { id: recipientIgsid }, message: { text } },
  });
}

/** Fecha del último DM entrante de ese interlocutor (para la ventana de 24 h). */
export async function lastInboundAt(
  organizationId: string,
  counterpartyIgsid: string,
): Promise<Date | null> {
  const rows = await getDb()
    .select({ createdAt: instagramDm.createdAt })
    .from(instagramDm)
    .where(
      and(
        eq(instagramDm.organizationId, organizationId),
        eq(instagramDm.counterpartyIgsid, counterpartyIgsid),
        eq(instagramDm.direction, "inbound"),
      ),
    )
    .orderBy(desc(instagramDm.createdAt))
    .limit(1);
  return rows[0]?.createdAt ?? null;
}

/** Registra un DM entrante de forma idempotente (dedup por `mid`). Devuelve si insertó. */
export async function recordInboundDm(input: {
  organizationId: string;
  counterpartyIgsid: string;
  text: string | null;
  igMessageId: string;
}): Promise<boolean> {
  const inserted = await getDb()
    .insert(instagramDm)
    .values({
      id: newId("instagramDm"),
      organizationId: input.organizationId,
      counterpartyIgsid: input.counterpartyIgsid,
      direction: "inbound",
      text: input.text,
      igMessageId: input.igMessageId,
    })
    .onConflictDoNothing({ target: instagramDm.igMessageId })
    .returning({ id: instagramDm.id });
  return inserted.length > 0;
}

/** Registra un DM saliente (para la traza del hilo). */
export async function recordOutboundDm(input: {
  organizationId: string;
  counterpartyIgsid: string;
  text: string;
}): Promise<void> {
  await getDb()
    .insert(instagramDm)
    .values({
      id: newId("instagramDm"),
      organizationId: input.organizationId,
      counterpartyIgsid: input.counterpartyIgsid,
      direction: "outbound",
      text: input.text,
      igMessageId: null,
    });
}
