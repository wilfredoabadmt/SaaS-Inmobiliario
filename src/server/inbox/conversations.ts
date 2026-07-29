import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { conversation } from "@/lib/db/schema/domain";

export interface ConvRef {
  id: string;
  aiEnabled: boolean;
  needsHuman: boolean;
}

/**
 * Obtiene o crea la conversación de un cliente (helper compartido — feature 009, DV-CM-5).
 * Lo usan el ingest del webhook (auto-alta) y el atajo "Enviar mensaje" del módulo de
 * contactos. Defaults: agente desactivado, sin handoff. NO envía nada ni aplica reglas de
 * canal — la ventana 24h / plantilla las decide la bandeja sobre los mensajes reales.
 */
export async function getOrCreateConversation(
  organizationId: string,
  clientId: string,
  phone: string,
): Promise<ConvRef> {
  const db = getDb();
  const existing = await db
    .select({
      id: conversation.id,
      aiEnabled: conversation.aiEnabled,
      needsHuman: conversation.needsHuman,
    })
    .from(conversation)
    .where(and(eq(conversation.organizationId, organizationId), eq(conversation.clientId, clientId)))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(1);
  const row = existing[0];
  if (row) return row;

  const id = newId("conversation");
  await db.insert(conversation).values({
    id,
    organizationId,
    clientId,
    waContactPhone: phone,
    lastMessageAt: new Date(),
  });
  return { id, aiEnabled: false, needsHuman: false };
}
