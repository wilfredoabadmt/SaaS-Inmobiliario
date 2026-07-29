import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { conversation, message, property, propertyPhoto } from "@/lib/db/schema/domain";
import {
  buildImagePayload,
  buildInteractiveButtonsPayload,
  buildTextPayload,
  graphRequest,
  type InteractiveButton,
} from "@/lib/meta";
import { getDownloadUrl } from "@/lib/storage";
import { toPropertyView } from "@/server/matching/engine";
import { formatPropertySheet, isServiceWindowOpen, sendAgentText } from "@/server/inbox/send";
import { getSendingCredentials } from "@/server/whatsapp/credentials";

/**
 * Envío de la **ficha-tarjeta** de una propiedad por WhatsApp (feature 006). Un solo
 * mensaje: foto principal + caption (+ botones opcionales). Sin foto → degrada a texto.
 * Mismo helper para el botón manual y para el agente. Solo datos del tenant.
 */

interface ConvRef {
  id: string;
  waContactPhone: string;
}

/** Error tipado para que el endpoint manual mapee el motivo a un HTTP claro. */
export class CardSendError extends Error {
  constructor(public readonly reason: "not_found" | "no_window" | "no_creds") {
    super(reason);
    this.name = "CardSendError";
  }
}

/** Los 3 botones de acción de una ficha (id codifica acción + propiedad). */
function propertyButtons(propertyId: string): InteractiveButton[] {
  return [
    { id: `visit:${propertyId}`, title: "Agendar visita" },
    { id: `handoff:${propertyId}`, title: "Hablar con asesor" },
    { id: `photos:${propertyId}`, title: "Más fotos" },
  ];
}

/** storageKey de la foto principal (menor sortOrder) del tenant, o null si no hay. */
async function mainPhotoKey(organizationId: string, propertyId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ storageKey: propertyPhoto.storageKey })
    .from(propertyPhoto)
    .where(
      and(
        eq(propertyPhoto.organizationId, organizationId),
        eq(propertyPhoto.propertyId, propertyId),
      ),
    )
    .orderBy(asc(propertyPhoto.sortOrder), asc(propertyPhoto.createdAt))
    .limit(1);
  return rows[0]?.storageKey ?? null;
}

/** ¿La conversación está dentro de la ventana de 24 h? (último entrante). */
async function windowOpen(conversationId: string): Promise<boolean> {
  const [last] = await getDb()
    .select({ waTimestamp: message.waTimestamp, createdAt: message.createdAt })
    .from(message)
    .where(and(eq(message.conversationId, conversationId), eq(message.direction, "inbound")))
    .orderBy(desc(message.createdAt))
    .limit(1);
  return isServiceWindowOpen(last?.waTimestamp ?? last?.createdAt ?? null);
}

/**
 * Envía la ficha de `propertyId` como tarjeta. `withButtons` añade los 3 botones; sin
 * foto degrada a texto (FR-004). Persiste el saliente con `property_id`.
 */
export async function sendPropertyCard(
  organizationId: string,
  conv: ConvRef,
  propertyId: string,
  opts: { withButtons?: boolean; aiGenerated?: boolean; senderUserId?: string } = {},
): Promise<void> {
  const db = getDb();
  const [prop] = await db
    .select()
    .from(property)
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .limit(1);
  // Archivada o inexistente → no se envía como ficha (FR-009): se trata como not_found.
  if (!prop || prop.archivedAt) throw new CardSendError("not_found");

  if (!(await windowOpen(conv.id))) throw new CardSendError("no_window");

  const creds = await getSendingCredentials(organizationId);
  if (!creds) throw new CardSendError("no_creds");

  const caption = formatPropertySheet(toPropertyView(prop));
  const key = await mainPhotoKey(organizationId, propertyId);
  const link = key ? await getDownloadUrl(key) : null;
  const withButtons = opts.withButtons ?? false;

  const payload =
    withButtons
      ? buildInteractiveButtonsPayload(conv.waContactPhone, {
          headerImageLink: link ?? undefined,
          body: caption,
          buttons: propertyButtons(propertyId),
        })
      : link
        ? buildImagePayload(conv.waContactPhone, link, caption)
        : buildTextPayload(conv.waContactPhone, caption);

  await graphRequest(
    `${creds.phoneNumberId}/messages`,
    { method: "POST", body: JSON.stringify(payload) },
    creds.token,
  );

  const now = new Date();
  await db.insert(message).values({
    id: newId("message"),
    organizationId,
    conversationId: conv.id,
    direction: "outbound",
    aiGenerated: opts.aiGenerated ?? false,
    senderUserId: opts.senderUserId ?? null,
    propertyId,
    body: caption,
    status: "sent",
    waTimestamp: now,
  });
  await db.update(conversation).set({ lastMessageAt: now }).where(eq(conversation.id, conv.id));
}

/**
 * Envía hasta 5 fotos **adicionales** (saltando la principal) de la propiedad del tenant.
 * Si no hay más, avisa con cortesía. Devuelve cuántas envió.
 */
export async function sendMorePhotos(
  organizationId: string,
  conv: ConvRef,
  propertyId: string,
): Promise<number> {
  const db = getDb();
  const [prop] = await db
    .select({ id: property.id })
    .from(property)
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .limit(1);
  if (!prop) return 0;

  const creds = await getSendingCredentials(organizationId);
  if (!creds) throw new CardSendError("no_creds");

  const photos = await db
    .select({ storageKey: propertyPhoto.storageKey })
    .from(propertyPhoto)
    .where(
      and(
        eq(propertyPhoto.organizationId, organizationId),
        eq(propertyPhoto.propertyId, propertyId),
      ),
    )
    .orderBy(asc(propertyPhoto.sortOrder), asc(propertyPhoto.createdAt));
  const extra = photos.slice(1, 6); // saltar la principal, hasta 5

  if (extra.length === 0) {
    await sendAgentText(
      organizationId,
      conv,
      "Por ahora no tengo más fotos de esta propiedad 📷. ¿Te ayudo con algo más?",
    );
    return 0;
  }

  for (const ph of extra) {
    const link = await getDownloadUrl(ph.storageKey);
    await graphRequest(
      `${creds.phoneNumberId}/messages`,
      { method: "POST", body: JSON.stringify(buildImagePayload(conv.waContactPhone, link)) },
      creds.token,
    );
    await db.insert(message).values({
      id: newId("message"),
      organizationId,
      conversationId: conv.id,
      direction: "outbound",
      aiGenerated: true,
      propertyId,
      status: "sent",
      waTimestamp: new Date(),
    });
  }
  await db
    .update(conversation)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversation.id, conv.id));
  return extra.length;
}
