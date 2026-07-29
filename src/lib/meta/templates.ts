import { z } from "zod";

/**
 * Modelo canónico de componentes de una plantilla de WhatsApp (feature 012, DV-WT-4).
 *
 * Es lo que el builder produce y persistimos en `template.components` (jsonb). Se traduce al
 * `components[]` de la Graph API al crear (`toMetaComponents`) y se vuelve a parsear al
 * sincronizar (`fromMetaComponents`). Variables = posicionales `{{1}}`, `{{2}}`, …
 *
 * Esta frontera NO hace I/O: solo tipos puros + traducción + render (data-model §3).
 */

// ---------- Conjuntos conocidos ----------

export const TEMPLATE_CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** Estatus de revisión conocidos (DV-WT-2). Valores nuevos de Meta se guardan tal cual. */
export const TEMPLATE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "DISABLED",
  "IN_APPEAL",
  "PENDING_DELETION",
  "DELETED",
  "LIMIT_EXCEEDED",
] as const;

// ---------- Modelo canónico (Zod) ----------

const headerSchema = z
  .object({
    format: z.enum(["TEXT", "IMAGE"]),
    text: z.string().max(60).optional(),
    /** TEXT con variable → valor de ejemplo. IMAGE → handle (transitorio, no se persiste). */
    example: z.string().optional(),
  })
  .strict();

const bodySchema = z
  .object({
    text: z.string().min(1).max(1024),
    variables: z.number().int().min(0).max(20),
    examples: z.array(z.string().min(1)).max(20),
  })
  .strict();

const footerSchema = z.object({ text: z.string().min(1).max(60) }).strict();

const buttonSchema = z
  .object({
    type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
    text: z.string().min(1).max(25),
    url: z.string().url().optional(),
    phoneNumber: z.string().optional(),
  })
  .strict();

export const templateComponentsSchema = z
  .object({
    header: headerSchema.optional(),
    body: bodySchema,
    footer: footerSchema.optional(),
    buttons: z.array(buttonSchema).max(3).optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    // El nº de variables del body debe coincidir con los ejemplos (Meta exige example.body_text).
    const declared = countVariables(c.body.text);
    if (declared !== c.body.variables) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "variables"],
        message: `El cuerpo declara ${c.body.variables} variables pero el texto tiene ${declared} ({{n}}).`,
      });
    }
    if (c.body.variables > 0 && c.body.examples.length !== c.body.variables) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "examples"],
        message: `Cada variable necesita un valor de ejemplo (${c.body.variables} requeridos).`,
      });
    }
    // Header de texto con variable {{1}} requiere ejemplo.
    if (c.header?.format === "TEXT" && c.header.text && countVariables(c.header.text) > 0) {
      if (!c.header.example) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["header", "example"],
          message: "El encabezado con variable necesita un valor de ejemplo.",
        });
      }
    }
    for (const [i, b] of (c.buttons ?? []).entries()) {
      if (b.type === "URL" && !b.url) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", i, "url"], message: "El botón URL requiere una URL." });
      }
      if (b.type === "PHONE_NUMBER" && !b.phoneNumber) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", i, "phoneNumber"], message: "El botón de llamada requiere un teléfono." });
      }
    }
  });

export type TemplateComponents = z.infer<typeof templateComponentsSchema>;

// ---------- Helpers de variables / render ----------

/** Cuenta variables posicionales distintas `{{n}}` en un texto. */
export function countVariables(text: string): number {
  const found = new Set<number>();
  for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n > 0) found.add(n);
  }
  return found.size;
}

/** Sustituye `{{1}}`,`{{2}}`,… por `values[i-1]` (para preview y para el cuerpo del hilo). */
export function renderBody(text: string, values: readonly string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_match, g1: string) => {
    const idx = Number(g1) - 1;
    return values[idx] ?? `{{${g1}}}`;
  });
}

// ---------- Traducción canónico → Meta (al crear) ----------

export interface MetaTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE";
  text?: string;
  example?: { header_text?: string[]; header_handle?: string[]; body_text?: string[][] };
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

/**
 * Traduce el modelo canónico al `components[]` de la Graph API. Para header de imagen se pasa el
 * `headerHandle` obtenido de la Resumable Upload API (DV-WT-5).
 */
export function toMetaComponents(
  c: TemplateComponents,
  opts: { headerHandle?: string } = {},
): MetaTemplateComponent[] {
  const out: MetaTemplateComponent[] = [];

  if (c.header) {
    if (c.header.format === "IMAGE") {
      const handle = opts.headerHandle;
      out.push({
        type: "HEADER",
        format: "IMAGE",
        ...(handle ? { example: { header_handle: [handle] } } : {}),
      });
    } else {
      const hasVar = c.header.text ? countVariables(c.header.text) > 0 : false;
      out.push({
        type: "HEADER",
        format: "TEXT",
        text: c.header.text ?? "",
        ...(hasVar && c.header.example ? { example: { header_text: [c.header.example] } } : {}),
      });
    }
  }

  out.push({
    type: "BODY",
    text: c.body.text,
    ...(c.body.variables > 0 ? { example: { body_text: [c.body.examples] } } : {}),
  });

  if (c.footer) out.push({ type: "FOOTER", text: c.footer.text });

  if (c.buttons && c.buttons.length > 0) {
    out.push({
      type: "BUTTONS",
      buttons: c.buttons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.type === "URL" && b.url ? { url: b.url } : {}),
        ...(b.type === "PHONE_NUMBER" && b.phoneNumber ? { phone_number: b.phoneNumber } : {}),
      })),
    });
  }

  return out;
}

// ---------- Traducción Meta → canónico (al sincronizar) ----------

/** Parsea el `components[]` que devuelve Meta a nuestro modelo canónico. Tolerante a faltantes. */
export function fromMetaComponents(metaComponents: unknown): TemplateComponents | null {
  if (!Array.isArray(metaComponents)) return null;
  let header: TemplateComponents["header"];
  let body: TemplateComponents["body"] | undefined;
  let footer: TemplateComponents["footer"];
  let buttons: TemplateComponents["buttons"];

  for (const raw of metaComponents) {
    const comp = raw as MetaTemplateComponent;
    if (comp.type === "HEADER") {
      if (comp.format === "IMAGE") header = { format: "IMAGE" };
      else {
        const ex = comp.example?.header_text?.[0];
        header = { format: "TEXT", text: comp.text ?? "", ...(ex ? { example: ex } : {}) };
      }
    } else if (comp.type === "BODY") {
      const text = comp.text ?? "";
      const examples = comp.example?.body_text?.[0] ?? [];
      body = { text, variables: countVariables(text), examples };
    } else if (comp.type === "FOOTER") {
      footer = { text: comp.text ?? "" };
    } else if (comp.type === "BUTTONS") {
      buttons = (comp.buttons ?? []).map((b) => ({
        type: (b.type as "QUICK_REPLY" | "URL" | "PHONE_NUMBER") ?? "QUICK_REPLY",
        text: b.text,
        ...(b.url ? { url: b.url } : {}),
        ...(b.phone_number ? { phoneNumber: b.phone_number } : {}),
      }));
    }
  }

  if (!body) return null;
  return { ...(header ? { header } : {}), body, ...(footer ? { footer } : {}), ...(buttons ? { buttons } : {}) };
}

// ---------- Componentes de ENVÍO (al mandar la plantilla con variables) ----------

export interface MetaSendComponent {
  type: "body";
  parameters: Array<{ type: "text"; text: string }>;
}

/**
 * Construye los `components` para enviar una plantilla con sus valores (DV-WT-9). Solo body por
 * ahora (header de imagen dinámico se difiere; ver DV-WT-5). Devuelve `[]` si no hay variables.
 */
export function buildSendComponents(values: readonly string[]): MetaSendComponent[] {
  if (values.length === 0) return [];
  return [{ type: "body", parameters: values.map((v) => ({ type: "text", text: v })) }];
}
