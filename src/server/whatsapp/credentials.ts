import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { metaCredentials } from "@/lib/db/schema/domain";
import { open, seal } from "@/lib/crypto";

/**
 * Servicio de credenciales de WhatsApp (T020). El token se cifra AES-256-GCM y
 * NUNCA se devuelve al cliente ni se registra (Principio I / FR-006).
 */
export interface ConnectionInput {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  accessToken: string;
}

export interface ConnectionStatus {
  status: "connected" | "disconnected" | "expired" | "none";
  displayPhoneNumber: string | null;
}

/** Crea/actualiza la conexión de la agencia (1 número por agencia, v1). */
export async function upsertMetaCredentials(
  organizationId: string,
  input: ConnectionInput,
): Promise<void> {
  const sealed = seal(input.accessToken);
  const db = getDb();
  await db
    .insert(metaCredentials)
    .values({
      id: newId("metaCredentials"),
      organizationId,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayPhoneNumber: input.displayPhoneNumber ?? null,
      encryptedToken: sealed.encryptedToken,
      tokenIv: sealed.tokenIv,
      authTag: sealed.authTag,
      status: "connected",
      connectedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: metaCredentials.organizationId,
      set: {
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        displayPhoneNumber: input.displayPhoneNumber ?? null,
        encryptedToken: sealed.encryptedToken,
        tokenIv: sealed.tokenIv,
        authTag: sealed.authTag,
        status: "connected",
        connectedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

/** Estado de conexión para la UI (sin token). */
export async function getConnectionStatus(organizationId: string): Promise<ConnectionStatus> {
  const rows = await getDb()
    .select({
      status: metaCredentials.status,
      displayPhoneNumber: metaCredentials.displayPhoneNumber,
    })
    .from(metaCredentials)
    .where(eq(metaCredentials.organizationId, organizationId))
    .limit(1);
  const row = rows[0];
  if (!row) return { status: "none", displayPhoneNumber: null };
  return { status: row.status, displayPhoneNumber: row.displayPhoneNumber };
}

/** Referencias de la conexión (sin token) para reusar al reconectar manualmente. */
export async function getCredentialRefs(
  organizationId: string,
): Promise<{ wabaId: string; phoneNumberId: string; displayPhoneNumber: string | null } | null> {
  const rows = await getDb()
    .select({
      wabaId: metaCredentials.wabaId,
      phoneNumberId: metaCredentials.phoneNumberId,
      displayPhoneNumber: metaCredentials.displayPhoneNumber,
    })
    .from(metaCredentials)
    .where(eq(metaCredentials.organizationId, organizationId))
    .limit(1);
  return rows[0] ?? null;
}

/** Token + phone_number_id descifrados (uso server-only para llamar a Meta). */
export async function getSendingCredentials(
  organizationId: string,
): Promise<{ phoneNumberId: string; token: string } | null> {
  const rows = await getDb()
    .select()
    .from(metaCredentials)
    .where(eq(metaCredentials.organizationId, organizationId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const token = open({
    encryptedToken: row.encryptedToken,
    tokenIv: row.tokenIv,
    authTag: row.authTag,
  });
  return { phoneNumberId: row.phoneNumberId, token };
}

/** Resuelve la agencia a partir del phone_number_id (ruteo de webhooks). */
export async function resolveOrgByPhoneNumberId(
  phoneNumberId: string,
): Promise<string | null> {
  const rows = await getDb()
    .select({ organizationId: metaCredentials.organizationId })
    .from(metaCredentials)
    .where(eq(metaCredentials.phoneNumberId, phoneNumberId))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

/**
 * Resuelve la agencia a partir del WABA id (feature 012). Necesario para rutear el webhook
 * `message_template_status_update`, que llega a nivel WABA y NO trae phone_number_id (DV-WT-6).
 */
export async function resolveOrgByWabaId(wabaId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ organizationId: metaCredentials.organizationId })
    .from(metaCredentials)
    .where(eq(metaCredentials.wabaId, wabaId))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

/**
 * Credenciales de GESTIÓN (feature 012): `wabaId` + token descifrado de la agencia, para llamar a
 * la WhatsApp Business Management API (crear/listar/eliminar plantillas, analítica). Server-only;
 * el token nunca sale del servidor. Null si la agencia no tiene WhatsApp conectado.
 */
export async function getManagementCredentials(
  organizationId: string,
): Promise<{ wabaId: string; phoneNumberId: string; token: string } | null> {
  const rows = await getDb()
    .select()
    .from(metaCredentials)
    .where(eq(metaCredentials.organizationId, organizationId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const token = open({
    encryptedToken: row.encryptedToken,
    tokenIv: row.tokenIv,
    authTag: row.authTag,
  });
  return { wabaId: row.wabaId, phoneNumberId: row.phoneNumberId, token };
}

/** Marca la conexión de WhatsApp como expirada (token inválido) — degradación reconnect_required. */
export async function markMetaCredentialsExpired(organizationId: string): Promise<void> {
  await getDb()
    .update(metaCredentials)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(metaCredentials.organizationId, organizationId));
}

/**
 * Restaura el estado de la conexión a `connected` (self-heal): si una operación crítica contra Meta
 * (p. ej. sincronizar plantillas) tiene éxito, el token es válido y limpiamos un `expired` previo.
 */
export async function markMetaCredentialsConnected(organizationId: string): Promise<void> {
  await getDb()
    .update(metaCredentials)
    .set({ status: "connected", updatedAt: new Date() })
    .where(
      and(eq(metaCredentials.organizationId, organizationId), ne(metaCredentials.status, "connected")),
    );
}
