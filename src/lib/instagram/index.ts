import { getEnv } from "@/lib/env";
import { MetaApiError, verifyWebhookSignature } from "@/lib/meta";

/**
 * Frontera de transporte de **Instagram API con Instagram Login** (feature 008): SOLO
 * transporte + tipos (Principio II). Host `graph.instagram.com`, token POR-TENANT (no el
 * System User de WhatsApp) y firma con `IG_APP_SECRET` (≠ `META_APP_SECRET`). NO se extiende
 * `src/lib/meta` porque su `graphBaseUrl()` está clavado a `graph.facebook.com`. Ver DV-IG-1.
 *
 * Reglas de seguridad: el `access_token` viaja como query param (patrón documentado de IG);
 * NUNCA loguear URLs completas ni tokens (Principio I).
 */

export { MetaApiError } from "@/lib/meta";

/** Base versionada de Graph para IG (p. ej. `https://graph.instagram.com/v25.0`). */
export function igGraphBaseUrl(): string {
  return `https://graph.instagram.com/${getEnv().IG_GRAPH_VERSION}`;
}

export interface IgRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  token: string;
  searchParams?: Record<string, string | undefined>;
  /** Cuerpo JSON (p. ej. envío de DM). Si se omite, no se manda body. */
  body?: unknown;
}

/** Llamada tipada a Graph IG (versión en el path). Lanza `MetaApiError` si no es 2xx. */
export async function igGraphRequest<T>(path: string, opts: IgRequestOptions): Promise<T> {
  const url = new URL(`${igGraphBaseUrl()}/${path}`);
  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  url.searchParams.set("access_token", opts.token);
  const init: RequestInit = { method: opts.method ?? "GET" };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { "Content-Type": "application/json" };
  }
  const res = await fetch(url, init);
  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new MetaApiError(res.status, `Instagram Graph error (${res.status})`, json);
  }
  return json as T;
}

// ---------- OAuth (Business Login for Instagram) ----------
// Estos endpoints viven en hosts/paths SIN versión, por eso no pasan por igGraphRequest.

export interface IgShortTokenResponse {
  access_token: string;
  user_id: string | number;
  permissions?: string[];
}

export interface IgLongTokenResponse {
  access_token: string;
  token_type?: string;
  /** segundos hasta expirar (~60 d). */
  expires_in: number;
}

/** Intercambia el `code` del callback por un token corto (`POST api.instagram.com`). */
export async function exchangeCodeForShortToken(code: string): Promise<IgShortTokenResponse> {
  const env = getEnv();
  const form = new URLSearchParams({
    client_id: env.IG_APP_ID,
    client_secret: env.IG_APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: env.IG_REDIRECT_URI,
    code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) throw new MetaApiError(res.status, `IG oauth short token (${res.status})`, json);
  // "Instagram API con Instagram Login" envuelve la respuesta en `data: [ { access_token, … } ]`;
  // el viejo Basic Display la devolvía plana. Normalizamos ambas para no pasar un token undefined
  // al intercambio de token largo (que devolvería el error genérico "Unsupported request").
  const obj = json as { data?: IgShortTokenResponse[] } & Partial<IgShortTokenResponse>;
  const node = Array.isArray(obj?.data) ? obj.data[0] : (obj as IgShortTokenResponse | undefined);
  if (!node?.access_token) {
    throw new MetaApiError(res.status, "IG oauth short token sin access_token en la respuesta", json);
  }
  return node;
}

/** Cambia el token corto por uno largo de 60 d (`GET graph.instagram.com/access_token`). */
export async function exchangeShortForLongToken(shortToken: string): Promise<IgLongTokenResponse> {
  const env = getEnv();
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", env.IG_APP_SECRET);
  url.searchParams.set("access_token", shortToken);
  const res = await fetch(url, { method: "GET" });
  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) throw new MetaApiError(res.status, `IG oauth long token (${res.status})`, json);
  return json as IgLongTokenResponse;
}

/** Renueva un token largo válido (extiende 60 d). Token inválido → lanza MetaApiError. */
export async function refreshLongToken(longToken: string): Promise<IgLongTokenResponse> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longToken);
  const res = await fetch(url, { method: "GET" });
  const json: unknown = await res.json().catch(() => undefined);
  if (!res.ok) throw new MetaApiError(res.status, `IG token refresh (${res.status})`, json);
  return json as IgLongTokenResponse;
}

/** Datos de la cuenta conectada (`GET /me?fields=user_id,username`). */
export async function fetchMe(token: string): Promise<{ user_id: string; username: string }> {
  const me = await igGraphRequest<{ user_id?: string; id?: string; username: string }>("me", {
    method: "GET",
    token,
    searchParams: { fields: "user_id,username" },
  });
  return { user_id: String(me.user_id ?? me.id), username: me.username };
}

/** Suscribe la cuenta a los webhooks `messages,comments` (idempotente en Meta). */
export async function subscribeInstagramWebhooks(token: string): Promise<void> {
  await igGraphRequest("me/subscribed_apps", {
    method: "POST",
    token,
    searchParams: { subscribed_fields: "messages,comments" },
  });
}

/** Verifica la firma `X-Hub-Signature-256` del webhook de IG con `IG_APP_SECRET`. */
export function verifyIgWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getEnv().IG_APP_SECRET;
  if (!secret) return false;
  return verifyWebhookSignature(rawBody, signatureHeader, secret);
}

// ---------- Tipos del webhook entrante de IG ----------

export interface IgInboundMessage {
  sender: { id: string };
  recipient: { id: string };
  timestamp?: number;
  message?: { mid: string; text?: string; is_echo?: boolean };
}

export interface IgCommentValue {
  id: string;
  text?: string;
  from?: { id: string; username?: string };
  media?: { id: string };
}

export interface IgWebhookEntry {
  /** ID de la cuenta de IG (negocio) dueña del evento → llave de ruteo (DV-IG-8). */
  id: string;
  time?: number;
  messaging?: IgInboundMessage[];
  changes?: Array<{ field: string; value: IgCommentValue }>;
}

export interface IgWebhookPayload {
  object: string;
  entry: IgWebhookEntry[];
}
