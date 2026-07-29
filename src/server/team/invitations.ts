import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { invitation, member, organization, user } from "@/lib/db/schema/auth";
import { getEnv } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { renderInvitationMail } from "@/lib/mail/templates";
import type { TeamRole } from "@/lib/team/schemas";

/**
 * Servicio de invitaciones de equipo (feature 013, US4). Reusa la tabla `invitation` de
 * Better Auth; `invitation.id` es el token del enlace de aceptación. Email best-effort
 * (degrada a enlace copiable, FR-020). Aceptación idempotente + aislada por email.
 */

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function asRole(role: string | null): TeamRole {
  return role === "owner" ? "owner" : "agent";
}

function roleLabel(role: TeamRole): string {
  return role === "owner" ? "dueño" : "agente";
}

function acceptUrlFor(token: string): string {
  return `${getEnv().APP_BASE_URL}/accept-invitation/${token}`;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: TeamRole;
  expiresAt: string;
}

export interface CreateInvitationResult {
  ok: boolean;
  code?: "already_member" | "already_invited";
  invitation?: PendingInvitation;
  acceptUrl?: string;
  emailSent?: boolean;
}

/** Invitaciones pendientes (no expiradas) de la organización. */
export async function listInvitations(organizationId: string): Promise<PendingInvitation[]> {
  const rows = await getDb()
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: asRole(r.role),
    expiresAt: r.expiresAt.toISOString(),
  }));
}

/** Crea una invitación + envía email best-effort. Rechaza duplicados con código legible. */
export async function createInvitation(
  organizationId: string,
  inviterId: string,
  email: string,
  role: TeamRole,
): Promise<CreateInvitationResult> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();

  // ¿Ya es miembro? (join member+user por email en esta org)
  const existingMember = await db
    .select({ id: member.id })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.organizationId, organizationId), eq(user.email, normalized)))
    .limit(1);
  if (existingMember.length > 0) return { ok: false, code: "already_member" };

  // ¿Ya tiene invitación pendiente no expirada?
  const existingInvite = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.email, normalized),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (existingInvite.length > 0) return { ok: false, code: "already_invited" };

  const id = newId("invitation");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await db.insert(invitation).values({
    id,
    organizationId,
    email: normalized,
    role,
    status: "pending",
    expiresAt,
    inviterId,
  });

  // Datos para el email (best-effort).
  const [inviter] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, inviterId))
    .limit(1);
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const acceptUrl = acceptUrlFor(id);
  const mail = renderInvitationMail({
    agencyName: org?.name ?? "tu agencia",
    inviterName: inviter?.name ?? "El equipo",
    roleLabel: roleLabel(role),
    acceptUrl,
  });
  const emailSent = await sendMail({ to: normalized, ...mail });

  return {
    ok: true,
    invitation: { id, email: normalized, role, expiresAt: expiresAt.toISOString() },
    acceptUrl,
    emailSent,
  };
}

/** Cancela una invitación pendiente del tenant. */
export async function cancelInvitation(
  organizationId: string,
  token: string,
): Promise<{ ok: boolean }> {
  const db = getDb();
  const [row] = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(and(eq(invitation.id, token), eq(invitation.organizationId, organizationId)))
    .limit(1);
  if (!row) return { ok: false };
  await db.update(invitation).set({ status: "cancelled" }).where(eq(invitation.id, token));
  return { ok: true };
}

export interface InvitationPreview {
  organizationName: string;
  email: string;
  role: TeamRole;
  state: "ok" | "invalid" | "expired" | "already_used";
}

/** Lee una invitación por token para la página de aceptación (estado legible). */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const db = getDb();
  const [row] = await db
    .select({
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      orgName: organization.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(eq(invitation.id, token))
    .limit(1);

  if (!row) {
    return { organizationName: "", email: "", role: "agent", state: "invalid" };
  }
  const base = { organizationName: row.orgName, email: row.email, role: asRole(row.role) } as const;
  if (row.status !== "pending") return { ...base, state: "already_used" };
  if (row.expiresAt.getTime() < Date.now()) return { ...base, state: "expired" };
  return { ...base, state: "ok" };
}

export type AcceptResult =
  | { ok: true; organizationId: string }
  | { ok: false; code: "invalid" | "expired" | "already_used" | "email_mismatch" };

/**
 * Acepta una invitación: valida estado/expiración/coincidencia de email, inserta la membresía
 * (idempotente) y marca la invitación aceptada. Usa el usuario de sesión (puede no tener org).
 */
export async function acceptInvitation(
  token: string,
  sessionUser: { userId: string; email: string },
): Promise<AcceptResult> {
  const db = getDb();
  const [inv] = await db
    .select({
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(eq(invitation.id, token))
    .limit(1);

  if (!inv) return { ok: false, code: "invalid" };
  if (inv.status !== "pending") return { ok: false, code: "already_used" };
  if (inv.expiresAt.getTime() < Date.now()) return { ok: false, code: "expired" };
  if (inv.email.toLowerCase() !== sessionUser.email.toLowerCase()) {
    return { ok: false, code: "email_mismatch" };
  }

  // Idempotencia: si ya es miembro de esa org, no insertar de nuevo.
  const [existing] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, inv.organizationId),
        eq(member.userId, sessionUser.userId),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(member).values({
      id: newId("member"),
      organizationId: inv.organizationId,
      userId: sessionUser.userId,
      role: asRole(inv.role),
    });
  }

  await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, token));
  return { ok: true, organizationId: inv.organizationId };
}
