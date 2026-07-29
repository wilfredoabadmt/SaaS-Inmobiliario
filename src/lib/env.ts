import { z } from "zod";

/**
 * Validación de variables de entorno (Zod). Lazy + memoizada: se valida al primer
 * acceso en runtime, no al importar, para no romper `next build`. Falla al arranque
 * (primera lectura) si falta alguna variable requerida.
 */
const envSchema = z.object({
  // App / Auth
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),
  APP_BASE_URL: z.string().url(),

  // Cifrado en reposo (AES-256-GCM): 32 bytes en base64
  ENCRYPTION_KEY: z.string().min(44),

  // Meta / WhatsApp Cloud API
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_CONFIG_ID: z.string().min(1),
  META_SYSTEM_USER_TOKEN: z.string().min(1),
  META_SOLUTION_PARTNER_ID: z.string().min(1),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  META_GRAPH_API_VERSION: z.string().min(1),

  // IA (OpenRouter) — agente conversacional + matching (feature 004).
  // Clave de plataforma en el MVP; aislada tras src/lib/ai (Principio II).
  // OPCIONAL: si falta, la IA queda OFF (degrada con gracia) pero la app sigue viva.
  OPENROUTER_API_TOKEN: z.string().default(""),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_AGENT_MODEL: z.string().min(1).default("deepseek/deepseek-v4-flash"),
  // Matching: gemini-2.5-flash-lite (~0.7s, JSON fiable). v4-pro se descartó: razona
  // pesado, lento (~45s) y agota tokens sin emitir contenido para esta tarea.
  OPENROUTER_MATCH_MODEL: z.string().min(1).default("google/gemini-2.5-flash-lite"),
  // Robustez del agente (feature 005): ventana de coalescencia de ráfaga (ms). El
  // agente espera este lapso para agrupar mensajes consecutivos del cliente y
  // responder una sola vez. Opcional; default ~6 s.
  AGENT_COALESCE_MS: z.coerce.number().int().min(0).default(6000),

  // Instagram (feature 008) — "Instagram API con Instagram Login" (graph.instagram.com).
  // Producto Instagram SEPARADO de WhatsApp: IG_APP_SECRET ≠ META_APP_SECRET y firma sus
  // propios webhooks + exchange de tokens. TODAS opcionales/degradables: si faltan, la feature
  // de IG queda OFF (la tarjeta/acciones se desactivan) pero la app sigue viva. Ver DV-IG-9.
  IG_APP_ID: z.string().default(""),
  IG_APP_SECRET: z.string().default(""),
  IG_REDIRECT_URI: z.string().default(""),
  IG_WEBHOOK_VERIFY_TOKEN: z.string().default(""),
  IG_GRAPH_VERSION: z.string().min(1).default("v25.0"),
  // Firma el token del proxy público de media (DV-IG-4) y el `state` OAuth (DV-IG-2).
  MEDIA_PROXY_SIGNING_SECRET: z.string().default(""),
  // Protege endpoints de cron (renovación de tokens de IG + recordatorios de visita). Si
  // falta, el cron rechaza todo.
  CRON_SECRET: z.string().default(""),

  // Google Calendar (feature 011) — OAuth por USUARIO (cada asesor conecta su cuenta).
  // Aislado tras src/lib/google (espejo de lib/instagram). TODAS opcionales/degradables: si
  // faltan, la conexión a Google queda OFF y la disponibilidad degrada a "horas hábiles −
  // visitas Inmox" (DV-VS-13). Ver specs/011-visit-scheduling/research.md.
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_REDIRECT_URI: z.string().default(""),

  // Email saliente (feature 011) — Gmail SMTP + App Password, remitente único temporal.
  // Aislado tras src/lib/mail. Opcionales/degradables: si faltan, los emails quedan OFF y el
  // agendado NO se cae (best-effort, FR-017). NUNCA loguear SMTP_PASS (Principio I).
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  MAIL_FROM_NAME: z.string().default("Homya"),

  // Almacenamiento de objetos (interfaz S3 estándar)
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((v) => v === "true" || v === "1"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Placeholders válidos SOLO para la fase de `next build` ("collecting page data"): permiten que
 * los módulos que leen env al importarse (p. ej. `src/lib/auth`) se carguen sin los secretos
 * reales, para que el BUILD no los necesite. Así los secretos viven solo en runtime y NO se pasan
 * como build-args de Coolify (no se filtran en los logs de build — Principio I). NUNCA se usan en
 * runtime: ahí el entorno real está presente y se valida de verdad. Ver memoria
 * `project-coolify-secret-exposure`.
 */
const BUILD_PLACEHOLDERS: Record<string, string> = {
  DATABASE_URL: "postgres://build:build@localhost:5432/build",
  BETTER_AUTH_SECRET: "build_placeholder_secret_000000000000",
  BETTER_AUTH_URL: "https://build.invalid",
  APP_BASE_URL: "https://build.invalid",
  ENCRYPTION_KEY: "A".repeat(44),
  META_APP_ID: "build",
  META_APP_SECRET: "build",
  META_CONFIG_ID: "build",
  META_SYSTEM_USER_TOKEN: "build",
  META_SOLUTION_PARTNER_ID: "build",
  META_WEBHOOK_VERIFY_TOKEN: "build",
  META_GRAPH_API_VERSION: "v21.0",
  S3_ENDPOINT: "https://build.invalid",
  S3_REGION: "auto",
  S3_BUCKET: "build",
  S3_ACCESS_KEY_ID: "build",
  S3_SECRET_ACCESS_KEY: "build",
  S3_FORCE_PATH_STYLE: "false",
};

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) {
    cached = parsed.data;
    return cached;
  }
  // En `next build` (collecting page data) los secretos reales NO están presentes (van solo en
  // runtime). No rompas el build: valida con placeholders. No se memoiza — en runtime es otro
  // proceso con el entorno real, donde se valida de verdad.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return envSchema.parse({ ...process.env, ...BUILD_PLACEHOLDERS });
  }
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Variables de entorno inválidas o faltantes: ${missing}`);
}

/**
 * ¿Está configurada la integración de Instagram? Si falta cualquier secreto core, la
 * feature degrada (OFF) en vez de fallar. `CRON_SECRET` se valida aparte en su endpoint.
 */
export function isInstagramConfigured(env: Env = getEnv()): boolean {
  return Boolean(
    env.IG_APP_ID &&
      env.IG_APP_SECRET &&
      env.IG_REDIRECT_URI &&
      env.IG_WEBHOOK_VERIFY_TOKEN &&
      env.MEDIA_PROXY_SIGNING_SECRET,
  );
}

/**
 * ¿Está configurada la integración de Google Calendar (feature 011)? Si falta cualquier
 * secreto core, la conexión a Google degrada (OFF) y la disponibilidad usa solo datos locales.
 */
export function isGoogleCalendarConfigured(env: Env = getEnv()): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

/**
 * ¿Está configurado el email saliente (feature 011)? Si falta, los envíos son no-op
 * (best-effort): el agendado nunca se cae por email (FR-017).
 */
export function isEmailConfigured(env: Env = getEnv()): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}
