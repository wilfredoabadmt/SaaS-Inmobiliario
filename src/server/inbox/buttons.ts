import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { conversation, conversationProperty, property } from "@/lib/db/schema/domain";
import { toPropertyView } from "@/server/matching/engine";
import { sendAgentText } from "@/server/inbox/send";
import { sendMorePhotos } from "@/server/inbox/ficha";

/**
 * Ruteo del toque de un botón de la ficha (feature 006). El id del botón codifica
 * `<acción>:<propertyId>`. Las acciones son **deterministas del sistema** y corren con o
 * sin agente (FR-012). Degrada con gracia (no rompe el webhook ni filtra secretos).
 */

interface ConvRef {
  id: string;
  waContactPhone: string;
}

/** Marca una propiedad como la **principal** de la conversación (contexto de agendado). */
async function setPrimaryProperty(
  organizationId: string,
  conversationId: string,
  propertyId: string,
): Promise<void> {
  const db = getDb();
  // Quitar la principal anterior (índice único parcial: una sola principal por conversación).
  await db
    .update(conversationProperty)
    .set({ isPrimary: false })
    .where(
      and(
        eq(conversationProperty.conversationId, conversationId),
        eq(conversationProperty.isPrimary, true),
      ),
    );
  await db
    .insert(conversationProperty)
    .values({
      id: newId("conversationProperty"),
      organizationId,
      conversationId,
      propertyId,
      isPrimary: true,
    })
    .onConflictDoUpdate({
      target: [conversationProperty.conversationId, conversationProperty.propertyId],
      set: { isPrimary: true },
    });
}

export async function handleButtonReply(
  organizationId: string,
  conv: ConvRef,
  buttonId: string,
): Promise<void> {
  try {
    const sep = buttonId.indexOf(":");
    if (sep < 0) return;
    const action = buttonId.slice(0, sep);
    const propertyId = buttonId.slice(sep + 1);
    if (!propertyId) return;

    const db = getDb();
    const [prop] = await db
      .select()
      .from(property)
      .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
      .limit(1);
    if (!prop) return; // propiedad no es del tenant o ya no existe
    const view = toPropertyView(prop);

    if (action === "handoff") {
      await db
        .update(conversation)
        .set({ needsHuman: true, needsHumanReason: "requested" })
        .where(eq(conversation.id, conv.id));
      await sendAgentText(
        organizationId,
        conv,
        "Con gusto te paso con un asesor 🙌. En un momento te atienden por aquí.",
      );
      return;
    }

    if (action === "photos") {
      await sendMorePhotos(organizationId, conv, propertyId);
      return;
    }

    if (action === "visit") {
      // Vincula la propiedad de interés y pide la fecha. Con el agente activo, su
      // schedule_visit (004) cierra la cita al recibir la fecha; con el agente off,
      // se marca para que el asesor agende.
      await setPrimaryProperty(organizationId, conv.id, propertyId);
      await sendAgentText(
        organizationId,
        conv,
        `¡Perfecto! 📅 ¿Qué día y hora te acomoda para visitar *${view.title}*?`,
      );
      const [c] = await db
        .select({ aiEnabled: conversation.aiEnabled })
        .from(conversation)
        .where(eq(conversation.id, conv.id))
        .limit(1);
      if (!c?.aiEnabled) {
        await db
          .update(conversation)
          .set({ needsHuman: true, needsHumanReason: "requested" })
          .where(eq(conversation.id, conv.id));
      }
      return;
    }
  } catch (e) {
    console.error(
      `[buttons] fallo ruteando tap en ${conv.id}:`,
      e instanceof Error ? e.message : String(e),
    );
  }
}
