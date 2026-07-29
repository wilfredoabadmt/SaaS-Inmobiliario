import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { conversation, message } from "@/lib/db/schema/domain";
import { buildTextPayload, graphRequest } from "@/lib/meta";
import { getSendingCredentials } from "@/server/whatsapp/credentials";
import type { PropertyView } from "@/lib/inbox/types";

interface ConvRef {
  id: string;
  waContactPhone: string;
}

/**
 * Envía un texto saliente generado por el agente de IA y lo persiste con
 * `ai_generated=true` (feature 004). Reusa `lib/meta` (normalización MX). Lanza si
 * no hay credenciales o Meta rechaza; el llamador degrada con gracia (FR-019).
 */
export async function sendAgentText(
  organizationId: string,
  conv: ConvRef,
  text: string,
): Promise<void> {
  const creds = await getSendingCredentials(organizationId);
  if (!creds) throw new Error("WhatsApp no conectado");

  await graphRequest(
    `${creds.phoneNumberId}/messages`,
    { method: "POST", body: JSON.stringify(buildTextPayload(conv.waContactPhone, text)) },
    creds.token,
  );

  const now = new Date();
  const db = getDb();
  await db.insert(message).values({
    id: newId("message"),
    organizationId,
    conversationId: conv.id,
    direction: "outbound",
    aiGenerated: true,
    body: text,
    status: "sent",
    waTimestamp: now,
  });
  await db.update(conversation).set({ lastMessageAt: now }).where(eq(conversation.id, conv.id));
}

/** Ventana de servicio de WhatsApp (24 h desde el último entrante). Fuente de verdad
 *  server-side del agente (feature 005); refleja el `windowOpen` del chat-thread. */
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
export function isServiceWindowOpen(lastInboundAt: Date | null | undefined): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() < SERVICE_WINDOW_MS;
}

/** Mensaje determinista (sin LLM) que pide al cliente escribir por texto cuando entra
 *  un no-texto (feature 005). No interpreta el contenido (FR-006). */
export const ASK_FOR_TEXT_MESSAGE =
  "¡Gracias por tu mensaje! 🙌 Por ahora no puedo escuchar audios ni ver imágenes o ubicaciones. " +
  "¿Me lo puedes escribir por texto y con gusto te ayudo?";

/** Envía el mensaje determinista de "pide texto" (reusa el envío + persistencia del agente). */
export async function sendAgentAskForText(organizationId: string, conv: ConvRef): Promise<void> {
  await sendAgentText(organizationId, conv, ASK_FOR_TEXT_MESSAGE);
}

/** Formatea la ficha de una propiedad como texto para WhatsApp. */
export function formatPropertySheet(p: PropertyView): string {
  const op = p.operation === "venta" ? "Venta" : "Renta";
  return [
    `🏡 *${p.title}*`,
    `${op} · ${p.zone}`,
    `${p.priceLabel} MXN`,
    p.specs,
  ]
    .filter(Boolean)
    .join("\n");
}
