import { z } from "zod";

/**
 * Validación compartida (cliente + servidor) de subida de imágenes de avatar/logo
 * (feature 013). Subida directa prefirmada a R2 en 2 fases, espejo de las fotos de
 * propiedades (007). Tipos jpeg/png/webp, ≤ 5 MB.
 */
export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const IMAGE_MIN_BYTES = 100; // descarta archivos corruptos/diminutos

const imageSignSchema = z.object({
  phase: z.literal("sign"),
  contentType: z.enum(IMAGE_CONTENT_TYPES),
});
const imageConfirmSchema = z.object({
  phase: z.literal("confirm"),
  id: z.string().min(1),
  storageKey: z.string().min(1),
  contentType: z.enum(IMAGE_CONTENT_TYPES),
  sizeBytes: z.number().int().gt(IMAGE_MIN_BYTES).max(IMAGE_MAX_BYTES),
});

/** POST de subida de imagen: discriminado por `phase` (sign → firma; confirm → persiste). */
export const imagePostSchema = z.discriminatedUnion("phase", [imageSignSchema, imageConfirmSchema]);
export type ImagePostInput = z.infer<typeof imagePostSchema>;

/** Extensión de archivo a partir del content-type (para construir la storage key). */
export function extForImage(contentType: ImageContentType): "jpg" | "png" | "webp" {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}
