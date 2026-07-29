import { z } from "zod";

/**
 * Esquemas Zod compartidos (cliente + servidor) de la administración de propiedades
 * (feature 007). Validan todo input externo antes de tocar la BD o el almacenamiento.
 */

export const OPERATION_TYPES = ["renta", "venta"] as const;
export const PROPERTY_TYPES = ["casa", "departamento", "local", "terreno"] as const;
export const PROPERTY_STATUSES = ["disponible", "apartada", "cerrada"] as const;

/** Tipos de imagen aceptados para la foto (F1): solo jpeg/png — Meta no envía webp fiable. */
export const PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png"] as const;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const PHOTO_MIN_BYTES = 1000; // descarta imágenes corruptas/diminutas (guardrail del seed)

// Campos de texto opcionales: "" o null se normalizan a null (no tocar / vaciar).
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalNonNegInt = z.number().int().min(0).nullish();
const optionalNonNegNum = z.number().min(0).nullish();

/** Crear propiedad — todos los campos del dominio. */
export const propertyCreateSchema = z.object({
  operationType: z.enum(OPERATION_TYPES),
  propertyType: z.enum(PROPERTY_TYPES),
  title: optionalText(200),
  price: z.number().positive({ message: "El precio debe ser mayor a 0" }),
  currency: z.string().trim().min(1).max(8).default("MXN"),
  address: optionalText(300),
  neighborhood: optionalText(160),
  city: optionalText(160),
  bedrooms: optionalNonNegInt,
  bathrooms: optionalNonNegNum,
  builtAreaM2: optionalNonNegNum,
  lotAreaM2: optionalNonNegNum,
  parkingSpaces: optionalNonNegInt,
  description: optionalText(4000),
  status: z.enum(PROPERTY_STATUSES).default("disponible"),
});

/** Editar propiedad — parcial (PATCH). No acepta `archivedAt` (endpoint propio). */
export const propertyUpdateSchema = propertyCreateSchema.partial();

export const statusSchema = z.object({ status: z.enum(PROPERTY_STATUSES) });
export const archiveSchema = z.object({ archived: z.boolean() });

// ---- Fotos: subida directa prefirmada en 2 pasos (DV-2) ----
const photoSignSchema = z.object({
  phase: z.literal("sign"),
  contentType: z.enum(PHOTO_CONTENT_TYPES),
  sizeBytes: z.number().int().gt(PHOTO_MIN_BYTES).max(PHOTO_MAX_BYTES),
});
const photoConfirmSchema = z.object({
  phase: z.literal("confirm"),
  photoId: z.string().min(1),
  storageKey: z.string().min(1),
  contentType: z.enum(PHOTO_CONTENT_TYPES),
  sizeBytes: z.number().int().gt(PHOTO_MIN_BYTES).max(PHOTO_MAX_BYTES),
});
/** POST /photos: discriminado por `phase` (sign → firma; confirm → crea la fila). */
export const photoPostSchema = z.discriminatedUnion("phase", [photoSignSchema, photoConfirmSchema]);

/** PATCH /photos/[id]: reordenar (`sortOrder`) o marcar principal (`make_main`). */
export const photoPatchSchema = z.union([
  z.object({ action: z.literal("make_main") }),
  z.object({ sortOrder: z.number().int().min(0) }),
]);

/** Upsert manual de requisitos del cliente (US5). Parcial + budgetMin ≤ budgetMax. */
export const requirementsManualSchema = z
  .object({
    operation: z.enum(OPERATION_TYPES).nullish(),
    budgetMin: z.number().min(0).nullish(),
    budgetMax: z.number().min(0).nullish(),
    zone: optionalText(200),
    propertyType: z.enum(PROPERTY_TYPES).nullish(),
    bedrooms: optionalNonNegInt,
    bathrooms: optionalNonNegNum,
    notes: optionalText(2000),
  })
  .refine(
    (v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax,
    { message: "El presupuesto mínimo no puede ser mayor al máximo", path: ["budgetMin"] },
  );

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>;
export type PhotoPostInput = z.infer<typeof photoPostSchema>;
export type PhotoPatchInput = z.infer<typeof photoPatchSchema>;
export type RequirementsManualInput = z.infer<typeof requirementsManualSchema>;
