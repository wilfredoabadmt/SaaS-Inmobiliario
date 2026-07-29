import { z } from "zod";

/**
 * Esquemas Zod compartidos (cliente + servidor) del pipeline de ventas (feature 010).
 * Validan todo input externo antes de tocar la BD.
 */

/** Crear trato manual desde el pipeline. `clientId` requerido; propiedad/etapa opcionales. */
export const dealCreateSchema = z.object({
  clientId: z.string().min(1, "Cliente requerido"),
  propertyId: z
    .string()
    .min(1)
    .nullish()
    .transform((v) => v ?? null),
  stageId: z
    .string()
    .min(1)
    .nullish()
    .transform((v) => v ?? null),
});

/**
 * PATCH de un trato: mover de etapa (`stageId`) y/o asignar agente (`assignedAgentId`, `null` =
 * "Sin asignar"). Al menos un campo. La asignación se cablea en US5; el movimiento en US1.
 */
export const dealPatchSchema = z
  .object({
    stageId: z.string().min(1).optional(),
    assignedAgentId: z.string().min(1).nullable().optional(),
  })
  .refine((d) => d.stageId !== undefined || d.assignedAgentId !== undefined, {
    message: "Nada que actualizar",
  });

export type DealCreateInput = z.infer<typeof dealCreateSchema>;
export type DealPatchInput = z.infer<typeof dealPatchSchema>;

// ---------- Configuración de etapas (US2, solo owner) ----------

/** Crear etapa intermedia: `label` requerido; `afterStageId` posiciona (o al final). */
export const stageCreateSchema = z.object({
  label: z.string().trim().min(1, "Nombre requerido").max(40),
  afterStageId: z
    .string()
    .min(1)
    .nullish()
    .transform((v) => v ?? null),
});

/** Renombrar etapa (permitido también para anclas: cambia solo la etiqueta). */
export const stagePatchSchema = z.object({
  label: z.string().trim().min(1, "Nombre requerido").max(40),
});

/** Reordenar atómico: lista exacta de ids de la org en el nuevo orden. */
export const stageReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export type StageCreateInput = z.infer<typeof stageCreateSchema>;
export type StagePatchInput = z.infer<typeof stagePatchSchema>;
export type StageReorderInput = z.infer<typeof stageReorderSchema>;
