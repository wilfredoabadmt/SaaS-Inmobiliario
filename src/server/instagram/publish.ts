import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { instagramPost, property, propertyPhoto } from "@/lib/db/schema/domain";
import { igGraphRequest } from "@/lib/instagram";
import { buildPublicImageUrl } from "@/lib/instagram/media-token";

/**
 * Publicación en Instagram (feature 008). 2 pasos: crear contenedor con `image_url` (URL
 * pública servida por el proxy, DV-IG-4) → `media_publish`. Modo genérico (key subida por el
 * cliente) y "desde propiedad" (foto principal + caption derivado de 007). Ver DV-IG-5.
 */

type PropertyRow = typeof property.$inferSelect;

/** Caption determinista a partir de los datos de la propiedad (editable antes de publicar). */
export function captionFromProperty(p: PropertyRow): string {
  const op = p.operationType === "renta" ? "Renta" : "Venta";
  const titulo = p.title?.trim() || `${capitalize(p.propertyType)} en ${op.toLowerCase()}`;
  const precio = formatPrice(p.price, p.currency);
  const ubicacion = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const specs = [
    p.bedrooms != null ? `${p.bedrooms} rec` : null,
    p.bathrooms != null ? `${p.bathrooms} baños` : null,
    p.builtAreaM2 != null ? `${p.builtAreaM2} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return [`${titulo} · ${op}`, `${precio}`, ubicacion || null, specs || null]
    .filter(Boolean)
    .join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPrice(price: string, currency: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return `${price} ${currency}`;
  return `${n.toLocaleString("es-MX")} ${currency}`;
}

export type ResolvePropertyResult =
  | { ok: true; imageKey: string; caption: string }
  | { ok: false; reason: "not_found" | "property_without_photo" };

/**
 * Resuelve imagen (foto principal = menor `sort_order`) y caption para "Publicar propiedad",
 * scoped por tenant. Propiedad inexistente → not_found; sin foto → property_without_photo.
 */
export async function resolvePropertyPublish(
  organizationId: string,
  propertyId: string,
  captionOverride?: string,
): Promise<ResolvePropertyResult> {
  const db = getDb();
  const rows = await db
    .select()
    .from(property)
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .limit(1);
  const prop = rows[0];
  if (!prop) return { ok: false, reason: "not_found" };

  const photos = await db
    .select({ storageKey: propertyPhoto.storageKey })
    .from(propertyPhoto)
    .where(eq(propertyPhoto.propertyId, propertyId))
    .orderBy(asc(propertyPhoto.sortOrder))
    .limit(1);
  const main = photos[0];
  if (!main) return { ok: false, reason: "property_without_photo" };

  return {
    ok: true,
    imageKey: main.storageKey,
    caption: captionOverride?.trim() || captionFromProperty(prop),
  };
}

export type PropertyPreview =
  | { ok: true; caption: string; hasPhoto: boolean }
  | { ok: false; reason: "not_found" };

/** Preview para el compositor "Publicar propiedad": caption derivado + si tiene foto. */
export async function getPropertyPublishPreview(
  organizationId: string,
  propertyId: string,
): Promise<PropertyPreview> {
  const db = getDb();
  const rows = await db
    .select()
    .from(property)
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .limit(1);
  const prop = rows[0];
  if (!prop) return { ok: false, reason: "not_found" };

  const photos = await db
    .select({ id: propertyPhoto.id })
    .from(propertyPhoto)
    .where(eq(propertyPhoto.propertyId, propertyId))
    .limit(1);

  return { ok: true, caption: captionFromProperty(prop), hasPhoto: photos.length > 0 };
}

/** Crea el contenedor de media (paso 1) y devuelve `creation_id`. */
export async function createMediaContainer(
  igUserId: string,
  token: string,
  imageUrl: string,
  caption?: string,
): Promise<string> {
  const res = await igGraphRequest<{ id: string }>(`${igUserId}/media`, {
    method: "POST",
    token,
    searchParams: { image_url: imageUrl, caption: caption || undefined },
  });
  return res.id;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Sondea el contenedor hasta `status_code === "FINISHED"`. Instagram procesa el media de
 * forma ASÍNCRONA; publicar antes de que esté listo devuelve el error 9007 ("Media ID is not
 * available", error_user_msg "no está listo para publicarse"). Lanza si queda en ERROR o si
 * no se completa dentro del presupuesto (~18 s). Ver self-test 008.
 */
export async function waitForMediaReady(
  token: string,
  creationId: string,
  { tries = 12, delayMs = 1500 }: { tries?: number; delayMs?: number } = {},
): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const res = await igGraphRequest<{ status_code?: string }>(creationId, {
      method: "GET",
      token,
      searchParams: { fields: "status_code" },
    });
    if (res.status_code === "FINISHED") return;
    if (res.status_code === "ERROR") {
      throw new Error("Instagram no pudo procesar la imagen (contenedor en ERROR).");
    }
    await sleep(delayMs);
  }
  throw new Error("El contenido no quedó listo para publicarse a tiempo. Intenta de nuevo.");
}

/** Publica el contenedor (paso 2) y devuelve el `ig_media_id` del post. */
export async function publishMedia(
  igUserId: string,
  token: string,
  creationId: string,
): Promise<string> {
  const res = await igGraphRequest<{ id: string }>(`${igUserId}/media_publish`, {
    method: "POST",
    token,
    searchParams: { creation_id: creationId },
  });
  return res.id;
}

/** ¿La cuenta llegó al límite diario (~100/24 h)? Best-effort: si falla la consulta, no bloquea. */
export async function isPublishingLimitReached(
  igUserId: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await igGraphRequest<{
      data?: Array<{ quota_usage?: number; config?: { quota_total?: number } }>;
    }>(`${igUserId}/content_publishing_limit`, {
      method: "GET",
      token,
      searchParams: { fields: "quota_usage,config" },
    });
    const row = res.data?.[0];
    if (!row || row.quota_usage == null || row.config?.quota_total == null) return false;
    return row.quota_usage >= row.config.quota_total;
  } catch {
    return false;
  }
}

/** Registra la publicación local tras `media_publish` (traza propiedad + caption). */
export async function recordPost(input: {
  organizationId: string;
  igMediaId: string;
  propertyId: string | null;
  caption: string | null;
  createdBy: string | null;
}): Promise<void> {
  await getDb()
    .insert(instagramPost)
    .values({
      id: newId("instagramPost"),
      organizationId: input.organizationId,
      igMediaId: input.igMediaId,
      propertyId: input.propertyId,
      caption: input.caption,
      mediaType: "IMAGE",
      createdBy: input.createdBy,
    })
    .onConflictDoNothing({ target: instagramPost.igMediaId });
}

/** URL pública (proxy) para una key de R2 — la consume Meta al crear el contenedor. */
export function publicImageUrl(imageKey: string): string {
  return buildPublicImageUrl(imageKey);
}
