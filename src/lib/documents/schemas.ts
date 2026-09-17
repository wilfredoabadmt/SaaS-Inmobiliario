import { z } from "zod";

export const ALLOWED_DOC_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_DOC_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export const docTypeSchema = z.enum(["identificacion", "comprobante_ingresos", "otro"]);

export const signDocUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_DOC_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_DOC_SIZE_BYTES),
  type: docTypeSchema,
});

export const confirmDocUploadSchema = z.object({
  id: z.string().min(1),
  storageKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_DOC_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_DOC_SIZE_BYTES),
  type: docTypeSchema,
});

export type DocType = z.infer<typeof docTypeSchema>;
export type SignDocUploadInput = z.infer<typeof signDocUploadSchema>;
export type ConfirmDocUploadInput = z.infer<typeof confirmDocUploadSchema>;
