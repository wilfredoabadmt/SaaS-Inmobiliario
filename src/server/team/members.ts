import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { member, user } from "@/lib/db/schema/auth";
import type { TeamRole } from "@/lib/team/schemas";

/**
 * Servicio de miembros del equipo (feature 013, US4). Solo owner muta (el endpoint aplica
 * `requireOwner`). Todo está scoped por `organizationId` (aislamiento de tenant). Guardia de
 * último owner: la organización nunca queda sin dueño (FR-017).
 */

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  joinedAt: string;
}

export type TeamMutationResult =
  | { ok: true }
  | { ok: false; code: "not_found" | "last_owner" };

function asRole(role: string): TeamRole {
  return role === "owner" ? "owner" : "agent";
}

/** Lista los miembros de la organización (solo de ese tenant). */
export async function listMembers(organizationId: string): Promise<TeamMember[]> {
  const rows = await getDb()
    .select({
      userId: member.userId,
      role: member.role,
      joinedAt: member.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId));

  return rows
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      email: r.email,
      role: asRole(r.role),
      joinedAt: r.joinedAt.toISOString(),
    }))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

/** Fila `member` de un usuario en la organización (o null si no es miembro de ese tenant). */
async function findMember(organizationId: string, userId: string) {
  const [row] = await getDb()
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Nº de owners de la organización (para el guardia de último owner). */
async function countOwners(organizationId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")));
  return rows.length;
}

/** Cambia el rol de un miembro. Bloquea degradar al único owner. */
export async function changeRole(
  organizationId: string,
  userId: string,
  role: TeamRole,
): Promise<TeamMutationResult> {
  const target = await findMember(organizationId, userId);
  if (!target) return { ok: false, code: "not_found" };

  if (asRole(target.role) === "owner" && role === "agent" && (await countOwners(organizationId)) <= 1) {
    return { ok: false, code: "last_owner" };
  }

  await getDb()
    .update(member)
    .set({ role })
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)));
  return { ok: true };
}

/** Elimina un miembro de la organización. Bloquea eliminar al único owner. */
export async function removeMember(
  organizationId: string,
  userId: string,
): Promise<TeamMutationResult> {
  const target = await findMember(organizationId, userId);
  if (!target) return { ok: false, code: "not_found" };

  if (asRole(target.role) === "owner" && (await countOwners(organizationId)) <= 1) {
    return { ok: false, code: "last_owner" };
  }

  await getDb()
    .delete(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)));
  return { ok: true };
}
