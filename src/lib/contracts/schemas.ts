import { z } from "zod";

export const ALLOWED_CONTRACT_MIME_TYPES = ["application/pdf"] as const;

export const MAX_CONTRACT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const contractStatusSchema = z.enum([
  "borrador",
  "enviado",
  "en_negociacion",
  "firmado",
]);

export const signContractUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_CONTRACT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_CONTRACT_SIZE_BYTES),
});

export const confirmContractUploadSchema = z.object({
  id: z.string().min(1),
  storageKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_CONTRACT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_CONTRACT_SIZE_BYTES),
});

export const updateContractStatusSchema = z.object({
  status: contractStatusSchema,
});

export type ContractStatus = z.infer<typeof contractStatusSchema>;
export type SignContractUploadInput = z.infer<typeof signContractUploadSchema>;
export type ConfirmContractUploadInput = z.infer<typeof confirmContractUploadSchema>;
