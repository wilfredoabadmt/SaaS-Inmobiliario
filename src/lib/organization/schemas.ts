import { z } from "zod";

/**
 * Esquemas Zod de los datos de la Organización (feature 013, US3). El logo reutiliza
 * el `imagePostSchema` compartido (subida prefirmada en 2 fases).
 */
export { imagePostSchema as logoPostSchema, type ImagePostInput } from "@/lib/images";

/** Editar el nombre de la agencia (PUT /api/organization). */
export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre de la agencia").max(100),
});

export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;
