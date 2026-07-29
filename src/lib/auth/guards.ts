import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { member } from "@/lib/db/schema/auth";

/**
 * Guard base de autorización (T009). Enforcement mínimo owner-only que reutilizan
 * el onboarding de WhatsApp (US1) y la gestión de equipo (US3). El rol se deriva
 * del `member` de la organización activa.
 */
export type AppRole = "owner" | "agent";

export interface ActiveContext {
  userId: string;
  organizationId: string;
  role: AppRole;
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 = 403,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Lee la sesión activa y resuelve el rol del usuario en su organización activa. */
export async function getActiveContext(): Promise<ActiveContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const activeOrganizationId = (
    session.session as { activeOrganizationId?: string | null }
  ).activeOrganizationId;
  if (!activeOrganizationId) return null;

  const rows = await getDb()
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, session.user.id), eq(member.organizationId, activeOrganizationId)),
    )
    .limit(1);

  const role: AppRole = rows[0]?.role === "owner" ? "owner" : "agent";
  return { userId: session.user.id, organizationId: activeOrganizationId, role };
}

/** Sesión autenticada SIN exigir organización activa (feature 013). */
export interface SessionContext {
  userId: string;
  email: string;
}

/**
 * Exige solo usuario autenticado, sin `activeOrganizationId` (DV-US-13). Lo usa la
 * aceptación de invitaciones: un invitado recién registrado aún no pertenece a ninguna
 * organización, así que `requireMember` (que exige org activa) lo rechazaría con 401.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new AuthorizationError("No autenticado", 401);
  return { userId: session.user.id, email: session.user.email };
}

/** Exige sesión + organización activa. */
export async function requireMember(): Promise<ActiveContext> {
  const ctx = await getActiveContext();
  if (!ctx) throw new AuthorizationError("No autenticado o sin organización activa", 401);
  return ctx;
}

/** Exige rol owner (acciones de cuenta/equipo y conexión de WhatsApp — FR-008). */
export async function requireOwner(): Promise<ActiveContext> {
  const ctx = await requireMember();
  if (ctx.role !== "owner") {
    throw new AuthorizationError("Acción restringida al dueño de la agencia", 403);
  }
  return ctx;
}

/** Convierte un AuthorizationError en Response JSON; si no lo es, devuelve undefined. */
export function authErrorResponse(error: unknown): Response | undefined {
  if (error instanceof AuthorizationError) {
    return Response.json(
      {
        error: {
          code: error.status === 401 ? "unauthorized" : "forbidden",
          message: error.message,
        },
      },
      { status: error.status },
    );
  }
  return undefined;
}
