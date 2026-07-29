import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import type { MetaTemplateComponent } from "./templates";

/**
 * Cliente de WhatsApp Cloud API: SOLO transporte + tipos en esta fase (Principio II:
 * integración externa aislada tras una frontera). Los endpoints de negocio se
 * implementan en las tareas de cada historia.
 */

export class MetaApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

export function graphBaseUrl(): string {
  return `https://graph.facebook.com/${getEnv().META_GRAPH_API_VERSION}`;
}

/** Llamada tipada a Graph API. `token` por defecto = system user token. */
export async function graphRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(`${graphBaseUrl()}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token ?? getEnv().META_SYSTEM_USER_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new MetaApiError(res.status, `Graph API error (${res.status})`, body);
  }
  return body as T;
}

/**
 * Verifica la firma `X-Hub-Signature-256` del webhook contra el raw body
 * (HMAC-SHA256 con META_APP_SECRET). Comparación en tiempo constante.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string = getEnv().META_APP_SECRET,
): boolean {
  if (!signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  return received.length === expectedBuf.length && timingSafeEqual(received, expectedBuf);
}

/**
 * Normaliza el destinatario para Cloud API.
 *
 * México: el wa_id que Meta entrega en los webhooks viene como `521` + 10 dígitos
 * (el "1" legado de celular), pero el envío —y la lista de destinatarios del número
 * de prueba— exige `52` + 10 dígitos. Sin quitar ese "1" Meta responde 131030
 * ("destinatario no permitido"). Solo dígitos en la salida.
 */
export function normalizeRecipient(raw: string): string {
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("521")) return "52" + d.slice(3);
  return d;
}

/** Construye el payload de envío de texto de Cloud API. */
export function buildTextPayload(to: string, body: string): SendTextPayload {
  return { messaging_product: "whatsapp", to: normalizeRecipient(to), type: "text", text: { body } };
}

/**
 * Suscribe la app al WABA del tenant (`POST /{waba_id}/subscribed_apps`).
 * Necesario para que los webhooks de ESE WABA lleguen a nuestro endpoint:
 * la suscripción `messages` del panel de Meta solo cubre el número de prueba
 * propio, no los WABA que entran por Embedded Signup. Idempotente en Meta.
 */
export async function subscribeAppToWaba(wabaId: string, token: string): Promise<void> {
  await graphRequest(`${wabaId}/subscribed_apps`, { method: "POST" }, token);
}

/** PIN de 6 dígitos (verificación en dos pasos) para registrar el número. */
export function generateRegistrationPin(): string {
  return String(randomInt(100000, 1000000));
}

/**
 * Registra el número en Cloud API (`POST /{phone_number_id}/register`): lo pasa
 * de PENDIENTE a activo para poder enviar/recibir. Establece el PIN de 2FA.
 * El PIN no se persiste (sandbox/Embedded Signup recién onboardeado); si en el
 * futuro se requiere re-registrar o gestionar 2FA, persistirlo cifrado.
 */
export async function registerPhoneNumber(
  phoneNumberId: string,
  token: string,
  pin: string,
): Promise<void> {
  await graphRequest(
    `${phoneNumberId}/register`,
    { method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", pin }) },
    token,
  );
}

// ---------- Tipos de payload (webhook entrante) ----------

export interface WhatsAppTextMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  // Respuesta a un botón interactivo (feature 006). El tap de un reply button llega como
  // type:"interactive" con interactive.button_reply.{id,title} (verificado vs doc de Meta
  // 2026-06-20). NO confundir con el botón de plantilla (type:"button" / button.payload).
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

export interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient_id?: string;
}

export interface WhatsAppChangeValue {
  metadata: { phone_number_id: string; display_phone_number?: string };
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
  messages?: WhatsAppTextMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{ field: string; value: WhatsAppChangeValue }>;
  }>;
}

// ---------- Tipos de envío (salida) ----------

export interface SendTextPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: { body: string };
}

// ---------- Tarjetas de ficha (feature 006): imagen + interactivo con botones ----------

export interface SendImagePayload {
  messaging_product: "whatsapp";
  to: string;
  type: "image";
  image: { link: string; caption?: string };
}

/** Mensaje de imagen con caption opcional (un solo mensaje: foto + texto). El caption
 *  admite hasta 1024 chars. La imagen se referencia por URL hospedada (`link`). */
export function buildImagePayload(to: string, link: string, caption?: string): SendImagePayload {
  const cap = caption?.trim() ? caption.slice(0, 1024) : undefined;
  return {
    messaging_product: "whatsapp",
    to: normalizeRecipient(to),
    type: "image",
    image: cap ? { link, caption: cap } : { link },
  };
}

export interface InteractiveButton {
  id: string;
  title: string;
}

export interface SendInteractivePayload {
  messaging_product: "whatsapp";
  to: string;
  type: "interactive";
  interactive: {
    type: "button";
    header?: { type: "image"; image: { link: string } };
    body: { text: string };
    action: { buttons: Array<{ type: "reply"; reply: { id: string; title: string } }> };
  };
}

/** Mensaje interactivo con hasta 3 reply buttons y header de imagen opcional (un solo
 *  mensaje: foto + texto + botones). Límites de Meta: body ≤1024, title ≤20, id ≤256. */
export function buildInteractiveButtonsPayload(
  to: string,
  opts: { headerImageLink?: string; body: string; buttons: InteractiveButton[] },
): SendInteractivePayload {
  return {
    messaging_product: "whatsapp",
    to: normalizeRecipient(to),
    type: "interactive",
    interactive: {
      type: "button",
      ...(opts.headerImageLink
        ? { header: { type: "image" as const, image: { link: opts.headerImageLink } } }
        : {}),
      body: { text: opts.body.slice(0, 1024) },
      action: {
        buttons: opts.buttons.slice(0, 3).map((b) => ({
          type: "reply" as const,
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    },
  };
}

// ============================================================================
// Gestión de plantillas — WhatsApp Business Management API (feature 012).
// Todas usan el TOKEN DE LA AGENCIA (multi-tenant), no el system user global.
// ============================================================================

// ---------- Mapeo de errores de Meta (DV-WT-10/11) ----------

interface MetaErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
  };
}

/** ¿El error de Meta es de autenticación (token inválido/expirado)? → reconnect_required. */
export function isMetaAuthError(err: unknown): boolean {
  if (!(err instanceof MetaApiError)) return false;
  if (err.status === 401) return true;
  const e = (err.body as MetaErrorBody | undefined)?.error;
  return e?.code === 190 || e?.type === "OAuthException";
}

/** Mensaje legible para el usuario a partir del error de Meta (sin exponer secretos). */
export function metaUserMessage(err: unknown): string {
  if (err instanceof MetaApiError) {
    const e = (err.body as MetaErrorBody | undefined)?.error;
    return e?.error_user_msg || e?.error_user_title || e?.message || `Error de WhatsApp (${err.status})`;
  }
  return "No se pudo contactar a WhatsApp. Intenta de nuevo.";
}

// ---------- Tipos ----------

export interface MetaTemplateResource {
  id: string;
  name: string;
  status: string;
  category?: string;
  language: string;
  components?: unknown;
  quality_score?: { score?: string };
  rejected_reason?: string;
}

export interface CreateTemplateResult {
  id: string;
  status: string;
  category?: string;
}

export interface TemplateAnalyticsPoint {
  templateId: string;
  start: number; // epoch s (inicio del día)
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  cost: number | null;
  currency: string | null;
}

// ---------- Crear / listar / eliminar ----------

/** Crea una plantilla y la envía a revisión: `POST /{waba_id}/message_templates`. */
export async function createMessageTemplate(
  wabaId: string,
  token: string,
  payload: {
    name: string;
    language: string;
    category: string;
    components: MetaTemplateComponent[];
  },
): Promise<CreateTemplateResult> {
  return graphRequest<CreateTemplateResult>(
    `${wabaId}/message_templates`,
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

/** Lista TODAS las plantillas del WABA (sigue la paginación por cursor). */
export async function listMessageTemplates(
  wabaId: string,
  token: string,
): Promise<MetaTemplateResource[]> {
  const fields = "name,status,category,language,components,id,quality_score,rejected_reason";
  const out: MetaTemplateResource[] = [];
  let path: string | null = `${wabaId}/message_templates?fields=${fields}&limit=100`;
  let guard = 0;
  while (path && guard < 20) {
    const page: { data?: MetaTemplateResource[]; paging?: { cursors?: { after?: string } } } =
      await graphRequest(path, {}, token);
    for (const t of page.data ?? []) out.push(t);
    const after = page.paging?.cursors?.after;
    path = after ? `${wabaId}/message_templates?fields=${fields}&limit=100&after=${encodeURIComponent(after)}` : null;
    guard += 1;
  }
  return out;
}

/** Elimina una plantilla: `DELETE /{waba_id}/message_templates?name=&hsm_id=`. */
export async function deleteMessageTemplate(
  wabaId: string,
  token: string,
  opts: { name: string; hsmId?: string | null },
): Promise<void> {
  const q = new URLSearchParams({ name: opts.name });
  if (opts.hsmId) q.set("hsm_id", opts.hsmId);
  await graphRequest(`${wabaId}/message_templates?${q.toString()}`, { method: "DELETE" }, token);
}

// ---------- Analítica (DV-WT-7) ----------

/** Suma un campo que Meta puede devolver como número o como array de breakdowns. */
function sumMetaMetric(value: unknown, valueKey = "count"): number {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) {
    return value.reduce((acc: number, item) => {
      const v = (item as Record<string, unknown>)?.[valueKey];
      return acc + (typeof v === "number" ? v : 0);
    }, 0);
  }
  return 0;
}

/**
 * Trae métricas diarias por plantilla: `GET /{waba_id}/template_analytics`.
 * `start`/`end` en epoch segundos. `templateIds` máx 10 por llamada. Parseo defensivo
 * (Meta varía shapes por versión); si no hay datos devuelve []. Costo = null si no lo expone.
 */
export async function getTemplateAnalytics(
  wabaId: string,
  token: string,
  args: { start: number; end: number; templateIds: string[] },
): Promise<TemplateAnalyticsPoint[]> {
  const q = new URLSearchParams({
    start: String(args.start),
    end: String(args.end),
    granularity: "DAILY",
    metric_types: JSON.stringify(["SENT", "DELIVERED", "READ", "CLICKED"]),
    template_ids: JSON.stringify(args.templateIds),
  });
  const res: { data?: Array<{ data_points?: Array<Record<string, unknown>> }> } = await graphRequest(
    `${wabaId}/template_analytics?${q.toString()}`,
    {},
    token,
  );
  const points: TemplateAnalyticsPoint[] = [];
  for (const series of res.data ?? []) {
    for (const dp of series.data_points ?? []) {
      const costRaw = dp.cost;
      let cost: number | null = null;
      let currency: string | null = null;
      if (typeof costRaw === "number") cost = costRaw;
      else if (Array.isArray(costRaw)) {
        cost = sumMetaMetric(costRaw, "value");
        const first = costRaw[0] as Record<string, unknown> | undefined;
        currency = typeof first?.currency === "string" ? first.currency : null;
      }
      points.push({
        templateId: String(dp.template_id ?? ""),
        start: typeof dp.start === "number" ? dp.start : 0,
        sent: sumMetaMetric(dp.sent),
        delivered: sumMetaMetric(dp.delivered),
        read: sumMetaMetric(dp.read),
        clicked: sumMetaMetric(dp.clicked),
        cost,
        currency,
      });
    }
  }
  return points;
}

// ---------- Resumable Upload (handle de imagen para header de plantilla, DV-WT-5) ----------

/**
 * Sube una imagen de muestra a la Resumable Upload API y devuelve el `header_handle`.
 * Paso 1: `POST /{app_id}/uploads?file_length=&file_type=` → upload session id.
 * Paso 2: `POST /{session_id}` (header `file_offset:0`, body binario) → `{ h }`.
 * Nota: la Resumable Upload usa `Authorization: OAuth <token>` (no Bearer).
 */
export async function uploadResumableSample(
  appId: string,
  token: string,
  bytes: Buffer,
  mime: string,
): Promise<string> {
  const base = graphBaseUrl();
  const startRes = await fetch(
    `${base}/${appId}/uploads?file_length=${bytes.byteLength}&file_type=${encodeURIComponent(mime)}`,
    { method: "POST", headers: { Authorization: `OAuth ${token}` } },
  );
  const startBody: unknown = await startRes.json().catch(() => undefined);
  if (!startRes.ok) throw new MetaApiError(startRes.status, "Resumable upload (start) falló", startBody);
  const sessionId = (startBody as { id?: string } | undefined)?.id;
  if (!sessionId) throw new MetaApiError(500, "Resumable upload sin id de sesión", startBody);

  const upRes = await fetch(`${base}/${sessionId}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_offset: "0" },
    body: new Uint8Array(bytes),
  });
  const upBody: unknown = await upRes.json().catch(() => undefined);
  if (!upRes.ok) throw new MetaApiError(upRes.status, "Resumable upload (transfer) falló", upBody);
  const handle = (upBody as { h?: string } | undefined)?.h;
  if (!handle) throw new MetaApiError(500, "Resumable upload sin handle", upBody);
  return handle;
}
