import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { instagramCredentials } from "@/lib/db/schema/domain";
import { open, seal } from "@/lib/crypto";

/**
 * Servicio de credenciales de Instagram (feature 008). El token largo (60 d) se cifra
 * AES-256-GCM y NUNCA se devuelve al cliente ni se loguea (Principio I). 1:1 por agencia.
 */

export type IgStatus = "connected" | "disconnected" | "expired" | "reconnect_required";

export interface IgConnectionStatusView {
  status: IgStatus | "none";
  username: string | null;
  igUserId: string | null;
  tokenExpiresAt: Date | null;
}

export interface SaveCredentialsInput {
  igUserId: string;
  username: string;
  accessToken: string;
  /** segundos hasta expirar el token largo (~60 d). */
  expiresInSeconds: number;
}

/** Crea/actualiza la conexión de IG de la agencia (1:1). */
export async function saveCredentials(
  organizationId: string,
  input: SaveCredentialsInput,
): Promise<void> {
  const sealed = seal(input.accessToken);
  const tokenExpiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
  const db = getDb();
  await db
    .insert(instagramCredentials)
    .values({
      id: newId("instagramCredentials"),
      organizationId,
      igUserId: input.igUserId,
      username: input.username,
      encryptedToken: sealed.encryptedToken,
      tokenIv: sealed.tokenIv,
      authTag: sealed.authTag,
      tokenExpiresAt,
      status: "connected",
      connectedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: instagramCredentials.organizationId,
      set: {
        igUserId: input.igUserId,
        username: input.username,
        encryptedToken: sealed.encryptedToken,
        tokenIv: sealed.tokenIv,
        authTag: sealed.authTag,
        tokenExpiresAt,
        status: "connected",
        connectedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

/** Credenciales descifradas para llamar a IG (server-only). `null` si no hay conexión. */
export async function getCredentials(organizationId: string): Promise<{
  igUserId: string;
  username: string;
  token: string;
  tokenExpiresAt: Date;
  status: IgStatus;
} | null> {
  const rows = await getDb()
    .select()
    .from(instagramCredentials)
    .where(eq(instagramCredentials.organizationId, organizationId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const token = open({
    encryptedToken: row.encryptedToken,
    tokenIv: row.tokenIv,
    authTag: row.authTag,
  });
  return {
    igUserId: row.igUserId,
    username: row.username,
    token,
    tokenExpiresAt: row.tokenExpiresAt,
    status: row.status,
  };
}

/** Estado para la UI (sin token). */
export async function getConnectionStatus(
  organizationId: string,
): Promise<IgConnectionStatusView> {
  const rows = await getDb()
    .select({
      status: instagramCredentials.status,
      username: instagramCredentials.username,
      igUserId: instagramCredentials.igUserId,
      tokenExpiresAt: instagramCredentials.tokenExpiresAt,
    })
    .from(instagramCredentials)
    .where(eq(instagramCredentials.organizationId, organizationId))
    .limit(1);
  const row = rows[0];
  if (!row) return { status: "none", username: null, igUserId: null, tokenExpiresAt: null };
  return {
    status: row.status,
    username: row.username,
    igUserId: row.igUserId,
    tokenExpiresAt: row.tokenExpiresAt,
  };
}

/** Elimina la conexión de la agencia (desconectar). */
export async function deleteCredentials(organizationId: string): Promise<void> {
  await getDb()
    .delete(instagramCredentials)
    .where(eq(instagramCredentials.organizationId, organizationId));
}

/** Resuelve la agencia a partir del `ig_user_id` (ruteo de webhooks, DV-IG-8). */
export async function resolveOrgByIgUserId(igUserId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ organizationId: instagramCredentials.organizationId })
    .from(instagramCredentials)
    .where(eq(instagramCredentials.igUserId, igUserId))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

/** Marca la cuenta como "reconectar" (token inválido / refresh fallido). */
export async function markReconnectRequired(organizationId: string): Promise<void> {
  await getDb()
    .update(instagramCredentials)
    .set({ status: "reconnect_required", updatedAt: new Date() })
    .where(eq(instagramCredentials.organizationId, organizationId));
}

/** Actualiza el token tras un refresh exitoso. */
export async function updateToken(
  organizationId: string,
  accessToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const sealed = seal(accessToken);
  await getDb()
    .update(instagramCredentials)
    .set({
      encryptedToken: sealed.encryptedToken,
      tokenIv: sealed.tokenIv,
      authTag: sealed.authTag,
      tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      status: "connected",
      updatedAt: new Date(),
    })
    .where(eq(instagramCredentials.organizationId, organizationId));
}

/** Conexiones `connected` cuyo token expira antes de `before` (para el cron de refresh). */
export async function listCredentialsForRefresh(before: Date): Promise<
  Array<{ organizationId: string; igUserId: string; token: string; tokenExpiresAt: Date }>
> {
  const rows = await getDb()
    .select()
    .from(instagramCredentials)
    .where(
      and(
        eq(instagramCredentials.status, "connected"),
        lt(instagramCredentials.tokenExpiresAt, before),
      ),
    );
  return rows.map((row) => ({
    organizationId: row.organizationId,
    igUserId: row.igUserId,
    token: open({
      encryptedToken: row.encryptedToken,
      tokenIv: row.tokenIv,
      authTag: row.authTag,
    }),
    tokenExpiresAt: row.tokenExpiresAt,
  }));
}
