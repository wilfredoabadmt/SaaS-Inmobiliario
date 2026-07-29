import { nanoid } from "nanoid";
import { extForImage, type ImageContentType } from "@/lib/images";
import { getDownloadUrl, getUploadUrl } from "@/lib/storage";

/**
 * Helper compartido de subida de imágenes (avatar y logo, feature 013). Espejo del patrón
 * de fotos de propiedades (007): firma un PUT directo a R2 bajo un `prefix` por usuario/org,
 * valida que la key confirmada pertenezca a ese prefijo (aislamiento) y resuelve la key a una
 * URL prefirmada de descarga al render.
 */

export interface SignedImageUpload {
  id: string;
  storageKey: string;
  uploadUrl: string;
}

/**
 * Fase 1: reserva una storage key bajo `prefix` (que DEBE terminar en "/") y firma el PUT.
 * NO persiste nada todavía.
 */
export async function signImageUpload(
  prefix: string,
  contentType: ImageContentType,
): Promise<SignedImageUpload> {
  const id = nanoid();
  const storageKey = `${prefix}${id}.${extForImage(contentType)}`;
  const uploadUrl = await getUploadUrl(storageKey, contentType);
  return { id, storageKey, uploadUrl };
}

/** ¿La key confirmada vive bajo el `prefix` esperado? (gate de aislamiento). */
export function isKeyUnderPrefix(storageKey: string, prefix: string): boolean {
  return storageKey.startsWith(prefix);
}

/** Resuelve una storage key (o null) a una URL prefirmada de descarga (~1 h). */
export async function resolveImageUrl(
  storageKey: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!storageKey) return null;
  return getDownloadUrl(storageKey, expiresInSeconds);
}
