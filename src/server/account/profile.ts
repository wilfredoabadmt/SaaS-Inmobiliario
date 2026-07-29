import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import type { ImageContentType } from "@/lib/images";
import {
  isKeyUnderPrefix,
  resolveImageUrl,
  signImageUpload,
  type SignedImageUpload,
} from "@/server/storage/images";

/**
 * Servicio del Perfil personal (feature 013, US1). Edita `user.name` y el avatar
 * (`user.image`, storage key) del usuario autenticado. El avatar se sube en 2 fases a R2
 * y se resuelve a URL prefirmada al render.
 */

function avatarPrefix(userId: string): string {
  return `avatars/${userId}/`;
}

export interface ProfileView {
  name: string;
  email: string;
  /** URL prefirmada del avatar, o null si no tiene. */
  avatarUrl: string | null;
}

/** Datos del perfil para la página (nombre, email, avatar resuelto). */
export async function getProfile(userId: string): Promise<ProfileView | null> {
  const [row] = await getDb()
    .select({ name: user.name, email: user.email, image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return null;
  return { name: row.name, email: row.email, avatarUrl: await resolveImageUrl(row.image) };
}

/** Actualiza el nombre visible del usuario. */
export async function updateName(userId: string, name: string): Promise<void> {
  await getDb().update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, userId));
}

/** Fase 1 del avatar: firma el PUT directo a R2 bajo el prefijo del usuario. */
export function signAvatar(
  userId: string,
  contentType: ImageContentType,
): Promise<SignedImageUpload> {
  return signImageUpload(avatarPrefix(userId), contentType);
}

/**
 * Fase 2: valida que la key pertenezca al espacio del usuario y persiste `user.image`.
 * Devuelve la URL prefirmada del nuevo avatar, o null si la key es inválida.
 */
export async function confirmAvatar(
  userId: string,
  input: { storageKey: string },
): Promise<{ avatarUrl: string | null } | null> {
  if (!isKeyUnderPrefix(input.storageKey, avatarPrefix(userId))) return null;
  await getDb()
    .update(user)
    .set({ image: input.storageKey, updatedAt: new Date() })
    .where(eq(user.id, userId));
  return { avatarUrl: await resolveImageUrl(input.storageKey) };
}

/** Resuelve una storage key de avatar a URL prefirmada (para el riel de navegación). */
export { resolveImageUrl as resolveAvatarUrl };
