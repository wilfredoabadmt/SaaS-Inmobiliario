import type { ZodSchema } from "zod";
import { getEnv } from "@/lib/env";

/**
 * Adaptador de IA (feature 004) — frontera única hacia OpenRouter (Chat Completions,
 * formato compatible OpenAI). El resto del código consume `chat()` / `chatJson<T>()`
 * sin acoplarse al proveedor (Principio II: integración externa aislada).
 *
 * La clave (`OPENROUTER_API_TOKEN`) NUNCA se loguea ni se devuelve (Principio I).
 */

export class AiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface ChatOpts {
  model: string;
  system: string;
  messages: ChatMsg[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Fuerza salida JSON (response_format json_object). */
  json?: boolean;
}

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

async function complete(opts: ChatOpts): Promise<string> {
  const env = getEnv();
  if (!env.OPENROUTER_API_TOKEN) {
    throw new AiError("IA no configurada (falta OPENROUTER_API_TOKEN)");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_TOKEN}`,
        "Content-Type": "application/json",
        // Atribución recomendada por OpenRouter (no son secretos).
        "HTTP-Referer": env.APP_BASE_URL,
        "X-Title": "Homya",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: opts.system },
          ...opts.messages,
        ],
        max_tokens: opts.maxTokens ?? 700,
        temperature: opts.temperature ?? 0.4,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => undefined)) as CompletionResponse | undefined;
    if (!res.ok) {
      // No incluimos el cuerpo crudo (puede traer eco de la petición); solo estado + mensaje corto.
      throw new AiError(data?.error?.message ?? `OpenRouter ${res.status}`, res.status);
    }
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new AiError("Respuesta de IA vacía");
    return content;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new AiError("Timeout de IA");
    throw new AiError(e instanceof Error ? e.message : "Error de IA");
  } finally {
    clearTimeout(timeout);
  }
}

/** Chat de texto. Devuelve el contenido del asistente. */
export async function chat(opts: Omit<ChatOpts, "json">): Promise<string> {
  return complete(opts);
}

/** Quita fences ```json … ``` si el modelo los añade. */
function stripFences(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (m?.[1] ?? t).trim();
}

/**
 * Extrae el objeto JSON de la salida del modelo aunque venga con texto alrededor
 * (algunos modelos ignoran a veces `response_format` y envuelven el JSON en prosa o
 * markdown). Intenta el texto tal cual y, si falla, la subcadena del primer `{` al
 * último `}`. `{ ok:false }` si nada parsea.
 */
function extractJson(s: string): { ok: true; value: unknown } | { ok: false } {
  const stripped = stripFences(s);
  const candidates = [stripped];
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(stripped.slice(first, last + 1));
  for (const c of candidates) {
    try {
      return { ok: true, value: JSON.parse(c) };
    } catch {
      /* siguiente candidato */
    }
  }
  return { ok: false };
}

/**
 * Chat forzando JSON, validado con un schema Zod. Tolera el formato del LLM: extrae el
 * JSON aunque venga con prosa y **reintenta una vez** con una instrucción más estricta
 * si la primera respuesta no parsea o no cumple el esquema (los modelos a veces se salen
 * del JSON en turnos cortos). Lanza AiError solo si falla dos veces.
 */
export async function chatJson<T>(
  opts: Omit<ChatOpts, "json"> & { schema: ZodSchema<T> },
): Promise<T> {
  const STRICT =
    "\n\nIMPORTANTE: responde EXCLUSIVAMENTE con el objeto JSON pedido — sin texto antes " +
    "ni después, sin comentarios y sin ```. Solo el objeto JSON.";
  const MAX_ATTEMPTS = 3; // 1 intento + 2 reintentos
  let lastErr: AiError | null = null;
  let lastRaw = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const system = attempt === 0 ? opts.system : opts.system + STRICT;

    // La llamada misma puede fallar de forma transitoria (respuesta vacía, timeout
    // puntual, 429): la envolvemos para reintentar en vez de tumbar el turno.
    let raw: string;
    try {
      raw = await complete({ ...opts, system, json: true });
    } catch (e) {
      if (e instanceof AiError) {
        lastErr = e;
        lastRaw = "";
        continue;
      }
      throw e;
    }
    lastRaw = raw;

    const extracted = extractJson(raw);
    if (!extracted.ok) {
      lastErr = new AiError("La IA no devolvió JSON válido");
      continue;
    }
    const result = opts.schema.safeParse(extracted.value);
    if (result.success) return result.data;
    const detail = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
      .slice(0, 200);
    lastErr = new AiError(`El JSON de la IA no cumple el esquema: ${detail}`);
  }

  // Falló todos los intentos: loguea el raw truncado (salida del modelo, NO secreto)
  // para poder diagnosticar qué devolvió. La clave nunca se incluye.
  console.error(
    `[ai] respuesta no usable tras ${MAX_ATTEMPTS} intentos (${lastErr?.message ?? "?"}): raw="${lastRaw
      .slice(0, 200)
      .replace(/\s+/g, " ")}"`,
  );
  throw lastErr ?? new AiError("La IA no devolvió JSON válido");
}
