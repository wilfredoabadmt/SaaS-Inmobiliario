import { z } from "zod";

/**
 * Esquemas Zod del Perfil personal (feature 013, US1). El avatar reutiliza el
 * `imagePostSchema` compartido (subida prefirmada en 2 fases).
 */
export { imagePostSchema as avatarPostSchema, type ImagePostInput } from "@/lib/images";

/** Editar el nombre visible del usuario (PATCH /api/account/profile). */
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(100),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
