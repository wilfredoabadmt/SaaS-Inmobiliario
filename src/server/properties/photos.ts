import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { property, propertyPhoto } from "@/lib/db/schema/domain";
import { deleteObject, getDownloadUrl, getUploadUrl } from "@/lib/storage";
import type { PropertyPhotoView } from "@/lib/inbox/types";

/**
 * URL prefirmada de la **foto principal** (menor `sortOrder`) por propiedad, para
 * mostrarla en la UI (matching, fichas del hilo). Solo del tenant. Expira en 1 h
 * (suficiente para una sesión de bandeja). Devuelve un mapa propertyId → URL; las
 * propiedades sin foto simplemente no aparecen (la UI usa el placeholder).
 */
export async function resolveMainPhotoUrls(
  organizationId: string,
  propertyIds: string[],
  expiresInSeconds = 3600,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(propertyIds)].filter(Boolean);
  if (ids.length === 0) return out;

  const rows = await getDb()
    .select({ propertyId: propertyPhoto.propertyId, storageKey: propertyPhoto.storageKey })
    .from(propertyPhoto)
    .where(
      and(eq(propertyPhoto.organizationId, organizationId), inArray(propertyPhoto.propertyId, ids)),
    )
    .orderBy(asc(propertyPhoto.sortOrder), asc(propertyPhoto.createdAt));

  const keyByProp = new Map<string, string>();
  for (const r of rows) if (!keyByProp.has(r.propertyId)) keyByProp.set(r.propertyId, r.storageKey);
  for (const [pid, key] of keyByProp) out.set(pid, await getDownloadUrl(key, expiresInSeconds));
  return out;
}

/** ¿La propiedad pertenece al tenant? (gate de aislamiento previo a tocar fotos). */
async function ownsProperty(organizationId: string, propertyId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: property.id })
    .from(property)
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .limit(1);
  return Boolean(row);
}

/** Filas crudas de fotos de una propiedad del tenant, ordenadas (principal primero). */
async function photoRows(organizationId: string, propertyId: string) {
  return getDb()
    .select()
    .from(propertyPhoto)
    .where(
      and(
        eq(propertyPhoto.organizationId, organizationId),
        eq(propertyPhoto.propertyId, propertyId),
      ),
    )
    .orderBy(asc(propertyPhoto.sortOrder), asc(propertyPhoto.createdAt));
}

/** Galería (URLs prefirmadas), principal = menor sortOrder (índice 0 tras el orden). */
export async function listPhotoViews(
  organizationId: string,
  propertyId: string,
): Promise<PropertyPhotoView[]> {
  const rows = await photoRows(organizationId, propertyId);
  const views: PropertyPhotoView[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    views.push({
      id: r.id,
      url: await getDownloadUrl(r.storageKey),
      sortOrder: r.sortOrder,
      isMain: i === 0,
    });
  }
  return views;
}

/** Reasigna `sortOrder` 0..n-1 en el orden dado (transacción). */
async function renumber(organizationId: string, orderedIds: string[]): Promise<void> {
  await getDb().transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(propertyPhoto)
        .set({ sortOrder: i })
        .where(
          and(
            eq(propertyPhoto.id, orderedIds[i]!),
            eq(propertyPhoto.organizationId, organizationId),
          ),
        );
    }
  });
}

export interface SignedUpload {
  photoId: string;
  storageKey: string;
  uploadUrl: string;
}

/**
 * Paso 1 de la subida: valida el tenant, reserva `storageKey` y firma el PUT directo a
 * R2. NO crea fila todavía (se crea al confirmar). Devuelve null si la propiedad no es
 * del tenant.
 */
export async function signUpload(
  organizationId: string,
  propertyId: string,
  contentType: "image/jpeg" | "image/png",
): Promise<SignedUpload | null> {
  if (!(await ownsProperty(organizationId, propertyId))) return null;
  const photoId = newId("propertyPhoto");
  const ext = contentType === "image/png" ? "png" : "jpg";
  const storageKey = `properties/${propertyId}/${photoId}.${ext}`;
  const uploadUrl = await getUploadUrl(storageKey, contentType);
  return { photoId, storageKey, uploadUrl };
}

/**
 * Paso 2: confirma la subida creando la fila `property_photo` al final del orden. El
 * `storageKey` DEBE pertenecer al prefijo de esa propiedad. Idempotente por `storageKey`
 * (un doble confirm no duplica). Devuelve la galería resultante, o null si tenant/clave inválidos.
 */
export async function confirmPhoto(
  organizationId: string,
  propertyId: string,
  input: { photoId: string; storageKey: string; contentType: string; sizeBytes: number },
): Promise<PropertyPhotoView[] | null> {
  if (!(await ownsProperty(organizationId, propertyId))) return null;
  if (!input.storageKey.startsWith(`properties/${propertyId}/`)) return null;

  const db = getDb();
  const rows = await photoRows(organizationId, propertyId);
  // Idempotencia (D1): si ya existe esa clave, no insertar de nuevo.
  if (!rows.some((r) => r.storageKey === input.storageKey)) {
    const nextOrder = rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sortOrder)) + 1;
    await db.insert(propertyPhoto).values({
      id: input.photoId,
      organizationId,
      propertyId,
      storageKey: input.storageKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      sortOrder: nextOrder,
    });
  }
  return listPhotoViews(organizationId, propertyId);
}

/** Reordena: mueve `photoId` al frente (principal) o a `sortOrder`. Renumera 0..n-1. */
export async function reorderPhoto(
  organizationId: string,
  propertyId: string,
  photoId: string,
  target: { action: "make_main" } | { sortOrder: number },
): Promise<PropertyPhotoView[] | null> {
  const rows = await photoRows(organizationId, propertyId);
  const ids = rows.map((r) => r.id);
  if (!ids.includes(photoId)) return null;

  const without = ids.filter((id) => id !== photoId);
  const index = "action" in target ? 0 : Math.max(0, Math.min(target.sortOrder, without.length));
  const ordered = [...without.slice(0, index), photoId, ...without.slice(index)];
  await renumber(organizationId, ordered);
  return listPhotoViews(organizationId, propertyId);
}

/** Elimina una foto (objeto + fila) y renumera el resto; principal sigue siendo el menor. */
export async function deletePhoto(
  organizationId: string,
  propertyId: string,
  photoId: string,
): Promise<PropertyPhotoView[] | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(propertyPhoto)
    .where(
      and(
        eq(propertyPhoto.id, photoId),
        eq(propertyPhoto.organizationId, organizationId),
        eq(propertyPhoto.propertyId, propertyId),
      ),
    )
    .limit(1);
  if (!row) return null;

  try {
    await deleteObject(row.storageKey);
  } catch {
    // El objeto pudo no existir (p. ej. subida interrumpida); no es fatal.
  }
  await db.delete(propertyPhoto).where(eq(propertyPhoto.id, photoId));

  const remaining = await photoRows(organizationId, propertyId);
  await renumber(
    organizationId,
    remaining.map((r) => r.id),
  );
  return listPhotoViews(organizationId, propertyId);
}
