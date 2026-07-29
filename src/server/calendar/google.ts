import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import {
  candidacy,
  client,
  googleCalendarCredentials,
  property,
  showing,
} from "@/lib/db/schema/domain";
import { open, seal } from "@/lib/crypto";
import { isGoogleCalendarConfigured } from "@/lib/env";
import {
  deleteEvent,
  GoogleAuthError,
  insertEvent,
  listCalendars,
  patchEvent,
  queryFreeBusy,
  refreshAccessToken,
  type GoogleCalendarEntry,
  type GoogleTokens,
} from "@/lib/google";
import type { UtcInterval } from "@/lib/time/slots";

/**
 * Integración con Google Calendar por asesor (feature 011, US4). Tokens (access + refresh)
 * cifrados AES-256-GCM por separado (DV-VS-7); NUNCA al cliente ni a logs. freeBusy bloquea la
 * disponibilidad; cada visita se espeja como evento. Token inválido → `reconnect_required` y
 * degradación: la operación de Inmox nunca se cae por Google (DV-VS-11/13).
 */

export interface GoogleBusyResult {
  connected: boolean;
  busy: UtcInterval[];
}

export type GoogleStatus = "connected" | "reconnect_required" | "disconnected";

export interface GoogleStatusView {
  status: GoogleStatus | "none" | "not_configured";
  email: string | null;
  calendarId: string | null;
  conflictCalendarIds: string[] | null;
  connectedAt: Date | null;
}

/** Normaliza el jsonb `conflict_calendar_ids` a `string[]` (o null). */
function parseConflictIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw.filter((x): x is string => typeof x === "string");
  return ids.length > 0 ? ids : null;
}

/** Guarda/actualiza las credenciales del asesor (1:1). Re-sella refresh solo si vino uno nuevo. */
export async function saveCredentials(
  organizationId: string,
  userId: string,
  tokens: GoogleTokens,
  calendarId = "primary",
): Promise<void> {
  const access = seal(tokens.accessToken);
  const expiresAt = new Date(Date.now() + tokens.expiresInSeconds * 1000);
  const refresh = tokens.refreshToken ? seal(tokens.refreshToken) : null;
  const db = getDb();

  const base = {
    googleSub: tokens.googleSub ?? "",
    email: tokens.email,
    calendarId,
    encryptedAccessToken: access.encryptedToken,
    accessIv: access.tokenIv,
    accessAuthTag: access.authTag,
    accessTokenExpiresAt: expiresAt,
    scope: tokens.scope,
    status: "connected" as const,
    updatedAt: new Date(),
  };
  const refreshCols = refresh
    ? { encryptedRefreshToken: refresh.encryptedToken, refreshIv: refresh.tokenIv, refreshAuthTag: refresh.authTag }
    : {};

  await db
    .insert(googleCalendarCredentials)
    .values({
      id: newId("googleCalendarCredentials"),
      organizationId,
      userId,
      connectedAt: new Date(),
      ...base,
      ...refreshCols,
    })
    .onConflictDoUpdate({
      target: [googleCalendarCredentials.organizationId, googleCalendarCredentials.userId],
      // Si no vino refresh nuevo, conserva el existente (no se sobreescribe con vacío).
      set: { ...base, ...refreshCols },
    });
}

/** Estado para la UI (sin token). */
export async function getStatusView(
  organizationId: string,
  userId: string,
): Promise<GoogleStatusView> {
  if (!isGoogleCalendarConfigured()) {
    return {
      status: "not_configured",
      email: null,
      calendarId: null,
      conflictCalendarIds: null,
      connectedAt: null,
    };
  }
  const [row] = await getDb()
    .select({
      status: googleCalendarCredentials.status,
      email: googleCalendarCredentials.email,
      calendarId: googleCalendarCredentials.calendarId,
      conflictCalendarIds: googleCalendarCredentials.conflictCalendarIds,
      connectedAt: googleCalendarCredentials.connectedAt,
    })
    .from(googleCalendarCredentials)
    .where(
      and(
        eq(googleCalendarCredentials.organizationId, organizationId),
        eq(googleCalendarCredentials.userId, userId),
      ),
    )
    .limit(1);
  if (!row)
    return { status: "none", email: null, calendarId: null, conflictCalendarIds: null, connectedAt: null };
  return {
    status: row.status,
    email: row.email,
    calendarId: row.calendarId,
    conflictCalendarIds: parseConflictIds(row.conflictCalendarIds),
    connectedAt: row.connectedAt,
  };
}

/** Lista los calendarios del asesor (para los selectores de UI). `null` si no utilizable. */
export async function listUserCalendars(
  organizationId: string,
  userId: string,
): Promise<GoogleCalendarEntry[] | null> {
  try {
    const access = await getValidAccess(organizationId, userId);
    if (!access) return null;
    return await listCalendars(access.accessToken);
  } catch (e) {
    if (e instanceof GoogleAuthError) await markReconnectRequired(organizationId, userId).catch(() => {});
    return null;
  }
}

/** Guarda la selección de calendario destino (escritura) y los de conflicto (freeBusy). */
export async function saveCalendarSelection(
  organizationId: string,
  userId: string,
  input: { targetCalendarId: string; conflictCalendarIds: string[] },
): Promise<void> {
  await getDb()
    .update(googleCalendarCredentials)
    .set({
      calendarId: input.targetCalendarId || "primary",
      conflictCalendarIds: input.conflictCalendarIds,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(googleCalendarCredentials.organizationId, organizationId),
        eq(googleCalendarCredentials.userId, userId),
      ),
    );
}

/** Elimina la conexión del asesor (desconectar). */
export async function disconnect(organizationId: string, userId: string): Promise<void> {
  await getDb()
    .delete(googleCalendarCredentials)
    .where(
      and(
        eq(googleCalendarCredentials.organizationId, organizationId),
        eq(googleCalendarCredentials.userId, userId),
      ),
    );
}

/** Marca la conexión como `reconnect_required` (token inválido / refresh fallido). */
export async function markReconnectRequired(organizationId: string, userId: string): Promise<void> {
  await getDb()
    .update(googleCalendarCredentials)
    .set({ status: "reconnect_required", updatedAt: new Date() })
    .where(
      and(
        eq(googleCalendarCredentials.organizationId, organizationId),
        eq(googleCalendarCredentials.userId, userId),
      ),
    );
}

/**
 * Access token válido del asesor (refresca on-demand si está por expirar). `null` si no hay
 * conexión utilizable (sin configurar, sin fila, `reconnect_required`, o refresh fallido).
 */
async function getValidAccess(
  organizationId: string,
  userId: string,
): Promise<{ accessToken: string; calendarId: string; conflictCalendarIds: string[] } | null> {
  if (!isGoogleCalendarConfigured()) return null;
  const [row] = await getDb()
    .select()
    .from(googleCalendarCredentials)
    .where(
      and(
        eq(googleCalendarCredentials.organizationId, organizationId),
        eq(googleCalendarCredentials.userId, userId),
      ),
    )
    .limit(1);
  if (!row || row.status !== "connected") return null;

  // Calendarios para conflictos: los elegidos, o el destino por defecto.
  const conflictCalendarIds = parseConflictIds(row.conflictCalendarIds) ?? [row.calendarId];

  const stillValid = row.accessTokenExpiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) {
    const accessToken = open({
      encryptedToken: row.encryptedAccessToken,
      tokenIv: row.accessIv,
      authTag: row.accessAuthTag,
    });
    return { accessToken, calendarId: row.calendarId, conflictCalendarIds };
  }

  // Necesita refresh.
  if (!row.encryptedRefreshToken || !row.refreshIv || !row.refreshAuthTag) {
    await markReconnectRequired(organizationId, userId);
    return null;
  }
  const refreshToken = open({
    encryptedToken: row.encryptedRefreshToken,
    tokenIv: row.refreshIv,
    authTag: row.refreshAuthTag,
  });
  try {
    const t = await refreshAccessToken(refreshToken);
    const access = seal(t.accessToken);
    const set: Record<string, unknown> = {
      encryptedAccessToken: access.encryptedToken,
      accessIv: access.tokenIv,
      accessAuthTag: access.authTag,
      accessTokenExpiresAt: new Date(Date.now() + t.expiresInSeconds * 1000),
      status: "connected",
      updatedAt: new Date(),
    };
    if (t.refreshToken) {
      const r = seal(t.refreshToken);
      set.encryptedRefreshToken = r.encryptedToken;
      set.refreshIv = r.tokenIv;
      set.refreshAuthTag = r.authTag;
    }
    await getDb()
      .update(googleCalendarCredentials)
      .set(set)
      .where(
        and(
          eq(googleCalendarCredentials.organizationId, organizationId),
          eq(googleCalendarCredentials.userId, userId),
        ),
      );
    return { accessToken: t.accessToken, calendarId: row.calendarId, conflictCalendarIds };
  } catch (e) {
    if (e instanceof GoogleAuthError) await markReconnectRequired(organizationId, userId);
    return null;
  }
}

/**
 * Periodos ocupados del Google Calendar del asesor en [fromISO, toISO]. Degrada a
 * `{ connected: false, busy: [] }` si no conectado / no configurado / falla (nunca lanza).
 */
export async function getGoogleBusy(
  organizationId: string,
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<GoogleBusyResult> {
  // Defensivo (DV-VS-13): NADA aquí debe lanzar — la disponibilidad jamás se cae por Google.
  // Envuelve TODO (incluido getValidAccess: open()/refresh/red), no solo el freeBusy.
  try {
    const access = await getValidAccess(organizationId, userId);
    if (!access) return { connected: false, busy: [] };
    const busy = await queryFreeBusy(access.accessToken, access.conflictCalendarIds, fromISO, toISO);
    return { connected: true, busy: busy.map((b) => ({ startUtc: b.start, endUtc: b.end })) };
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      await markReconnectRequired(organizationId, userId).catch(() => {});
    } else {
      console.error("[google] getGoogleBusy degradó:", e instanceof Error ? e.message : String(e));
    }
    return { connected: false, busy: [] };
  }
}

/**
 * Sincroniza una visita con el Google Calendar del asesor: `created` crea evento (guarda
 * `google_event_id`), `rescheduled` lo mueve, `cancelled` lo borra. Idempotente por
 * `google_event_id` (DV-VS-11). Best-effort: nunca lanza (la operación de Inmox no depende de Google).
 */
export async function syncShowingToGoogle(
  kind: "created" | "rescheduled" | "cancelled",
  organizationId: string,
  showingId: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      agentId: showing.agentId,
      scheduledAt: showing.scheduledAt,
      durationMinutes: showing.durationMinutes,
      googleEventId: showing.googleEventId,
      propTitle: property.title,
      clientName: client.name,
    })
    .from(showing)
    .innerJoin(property, eq(showing.propertyId, property.id))
    .leftJoin(candidacy, eq(showing.candidacyId, candidacy.id))
    .leftJoin(client, eq(candidacy.clientId, client.id))
    .where(and(eq(showing.id, showingId), eq(showing.organizationId, organizationId)))
    .limit(1);
  if (!row) return;

  const access = await getValidAccess(organizationId, row.agentId);
  if (!access) return; // degradación: sin Google conectado/utilizable

  const startISO = row.scheduledAt.toISOString();
  const endISO = new Date(row.scheduledAt.getTime() + (row.durationMinutes ?? 60) * 60_000).toISOString();
  const event = {
    summary: `Visita: ${row.propTitle ?? "Propiedad"}`,
    description: `Cliente: ${row.clientName ?? "Cliente de WhatsApp"}`,
    startISO,
    endISO,
  };

  try {
    if (kind === "cancelled") {
      if (row.googleEventId) await deleteEvent(access.accessToken, access.calendarId, row.googleEventId);
      return;
    }
    if (row.googleEventId) {
      await patchEvent(access.accessToken, access.calendarId, row.googleEventId, event);
    } else {
      const eventId = await insertEvent(access.accessToken, access.calendarId, event);
      await db
        .update(showing)
        .set({ googleEventId: eventId, updatedAt: new Date() })
        .where(and(eq(showing.id, showingId), eq(showing.organizationId, organizationId)));
    }
  } catch (e) {
    if (e instanceof GoogleAuthError) await markReconnectRequired(organizationId, row.agentId);
    // otros errores: se ignoran (best-effort); la visita en Inmox ya está persistida.
  }
}
