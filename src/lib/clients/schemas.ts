import { z } from "zod";

/**
 * Esquemas Zod compartidos (cliente + servidor) del módulo de contactos (feature 009).
 * Validan todo input externo antes de tocar la BD.
 */

// Texto opcional: "" / null / ausente → null (no tocar / vaciar).
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

// Email opcional con validación de formato solo cuando viene presente.
const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), { message: "Correo inválido" });

/**
 * Teléfono → solo dígitos. Se almacena en la MISMA forma que el `wa_id` que guarda el
 * webhook (`msg.from`), para que la deduplicación por (org, phone) funcione. La conversión
 * MX 521→52 vive en `normalizeRecipient` y es SOLO para enviar, no para almacenar. (DV-CM-7)
 */
const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().min(8, "Teléfono inválido").max(15, "Teléfono inválido"));

/** Crear contacto manual — `phone` requerido; el canal lo fija el servidor a "manual". */
export const clientCreateSchema = z.object({
  name: optionalText(120),
  phone: phoneSchema,
  email: optionalEmail,
  notes: optionalText(2000),
});

/** Editar contacto — parcial (PATCH). Clave ausente = no tocar; "" = vaciar. No acepta `channel`. */
export const clientUpdateSchema = clientCreateSchema.partial();

/** Archivar/desarchivar contacto (soft-delete reversible). */
export const clientArchiveSchema = z.object({ archived: z.boolean() });

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
