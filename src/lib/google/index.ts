import { getEnv } from "@/lib/env";

/**
 * Frontera de Google (feature 011, US4). Cliente por fetch (sin `googleapis`): OAuth
 * (authorize/exchange/refresh), freeBusy (lectura de ocupado) y events CRUD (escritura).
 * Aislado del dominio, espejo de `lib/instagram`. Ver specs/011-visit-scheduling/research.md.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
] as const;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

/** Token inválido/revocado (invalid_grant / 401): el caller marca `reconnect_required`. */
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  scope: string | null;
  googleSub: string | null;
  email: string | null;
}

/** URL de autorización (offline + consent para garantizar refresh_token la primera vez). */
export function buildAuthorizeUrl(state: string): string {
  const env = getEnv();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

/** Decodifica el payload de un id_token (JWT) sin verificar firma (viene de Google sobre TLS). */
function decodeIdToken(idToken: string | undefined): { sub: string | null; email: string | null } {
  if (!idToken) return { sub: null, email: null };
  try {
    const part = idToken.split(".")[1];
    if (!part) return { sub: null, email: null };
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as {
      sub?: string;
      email?: string;
    };
    return { sub: json.sub ?? null, email: json.email ?? null };
  } catch {
    return { sub: null, email: null };
  }
}

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
}

/** Intercambia el `code` por tokens (incluye refresh la primera vez con prompt=consent). */
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const env = getEnv();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as RawTokenResponse;
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant") throw new GoogleAuthError("invalid_grant en exchange");
    throw new Error(`Google token exchange falló: ${res.status} ${body.error ?? ""}`);
  }
  const id = decodeIdToken(body.id_token);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresInSeconds: body.expires_in ?? 3600,
    scope: body.scope ?? null,
    googleSub: id.sub,
    email: id.email,
  };
}

/** Refresca el access token con el refresh token. Lanza `GoogleAuthError` si fue revocado. */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const env = getEnv();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as RawTokenResponse;
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant") throw new GoogleAuthError("invalid_grant en refresh");
    throw new Error(`Google token refresh falló: ${res.status} ${body.error ?? ""}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresInSeconds: body.expires_in ?? 3600,
    scope: body.scope ?? null,
    googleSub: null,
    email: null,
  };
}

export interface BusyInterval {
  start: string;
  end: string;
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  primary: boolean;
  /** true si se puede ESCRIBIR (owner/writer) — solo estos sirven como calendario destino. */
  canWrite: boolean;
}

/**
 * Lista TODOS los calendarios legibles del usuario (para elegir cuáles bloquean + destino).
 * Incluye los de solo lectura (p. ej. un calendario de trabajo suscrito) para que puedan contar
 * como conflicto; `canWrite` marca cuáles pueden ser destino de escritura. 401 → GoogleAuthError.
 */
export async function listCalendars(accessToken: string): Promise<GoogleCalendarEntry[]> {
  const res = await fetch(`${CAL_BASE}/users/me/calendarList?minAccessRole=reader&maxResults=250`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw new GoogleAuthError("401 en calendarList");
  if (!res.ok) throw new Error(`Google calendarList falló: ${res.status}`);
  const body = (await res.json()) as {
    items?: Array<{ id?: string; summary?: string; primary?: boolean; accessRole?: string }>;
  };
  return (body.items ?? [])
    .filter((c) => c.id)
    .map((c) => ({
      id: c.id as string,
      summary: c.summary ?? c.id ?? "",
      primary: Boolean(c.primary),
      canWrite: c.accessRole === "owner" || c.accessRole === "writer",
    }));
}

/**
 * Periodos ocupados (merge) de uno o varios calendarios en [fromISO, toISO]. Lanza
 * `GoogleAuthError` si 401. Acepta varios `calendarIds` para que eventos en cualquiera de los
 * calendarios elegidos bloqueen la disponibilidad.
 */
export async function queryFreeBusy(
  accessToken: string,
  calendarIds: string[],
  fromISO: string,
  toISO: string,
): Promise<BusyInterval[]> {
  const ids = calendarIds.length > 0 ? calendarIds : ["primary"];
  const res = await fetch(`${CAL_BASE}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: fromISO, timeMax: toISO, items: ids.map((id) => ({ id })) }),
  });
  if (res.status === 401) throw new GoogleAuthError("401 en freeBusy");
  if (!res.ok) throw new Error(`Google freeBusy falló: ${res.status}`);
  const body = (await res.json()) as {
    calendars?: Record<string, { busy?: BusyInterval[] }>;
  };
  const out: BusyInterval[] = [];
  for (const id of ids) out.push(...(body.calendars?.[id]?.busy ?? []));
  return out;
}

export interface EventInput {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
}

/** Crea un evento y devuelve su id. Lanza `GoogleAuthError` si 401. */
export async function insertEvent(
  accessToken: string,
  calendarId: string,
  input: EventInput,
): Promise<string> {
  const res = await fetch(`${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startISO },
      end: { dateTime: input.endISO },
    }),
  });
  if (res.status === 401) throw new GoogleAuthError("401 en insertEvent");
  if (!res.ok) throw new Error(`Google insertEvent falló: ${res.status}`);
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new Error("Google insertEvent sin id");
  return body.id;
}

/** Actualiza start/end (y summary) de un evento. Lanza `GoogleAuthError` si 401. */
export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  input: EventInput,
): Promise<void> {
  const res = await fetch(
    `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startISO },
        end: { dateTime: input.endISO },
      }),
    },
  );
  if (res.status === 401) throw new GoogleAuthError("401 en patchEvent");
  if (res.status === 404 || res.status === 410) return; // ya no existe: idempotente
  if (!res.ok) throw new Error(`Google patchEvent falló: ${res.status}`);
}

/** Borra un evento. Idempotente (404/410 = ya borrado). Lanza `GoogleAuthError` si 401. */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(
    `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 401) throw new GoogleAuthError("401 en deleteEvent");
  if (res.status === 404 || res.status === 410) return;
  if (!res.ok) throw new Error(`Google deleteEvent falló: ${res.status}`);
}
