import { z } from "zod";

/**
 * Esquemas Zod de la gestión de Equipo (feature 013, US4). Roles owner/agent (espejo de
 * `AppRole`). Se normaliza el email (trim + lowercase) para la detección de duplicados.
 */
export const TEAM_ROLES = ["owner", "agent"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** Invitar a un miembro por email + rol. */
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Introduce un correo válido"),
  role: z.enum(TEAM_ROLES),
});

/** Cambiar el rol de un miembro. */
export const roleUpdateSchema = z.object({
  role: z.enum(TEAM_ROLES),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
