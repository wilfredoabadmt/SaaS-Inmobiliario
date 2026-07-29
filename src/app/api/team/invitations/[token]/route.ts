import type { NextRequest } from "next/server";
import { authErrorResponse, requireOwner, requireSession } from "@/lib/auth/guards";
import { acceptInvitation, cancelInvitation } from "@/server/team/invitations";

export const dynamic = "force-dynamic";

const ACCEPT_ERROR: Record<
  "invalid" | "expired" | "already_used" | "email_mismatch",
  { status: number; message: string }
> = {
  invalid: { status: 404, message: "Esta invitación no es válida" },
  expired: { status: 410, message: "Esta invitación expiró. Pide una nueva." },
  already_used: { status: 409, message: "Esta invitación ya fue usada o cancelada" },
  email_mismatch: {
    status: 403,
    message: "Esta invitación es para otro correo. Inicia sesión con ese correo.",
  },
};

/** DELETE — cancela una invitación pendiente (solo owner). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const { token } = await params;
  const result = await cancelInvitation(organizationId, token);
  if (!result.ok) {
    return Response.json(
      { error: { code: "not_found", message: "Invitación no encontrada" } },
      { status: 404 },
    );
  }
  return Response.json({ ok: true });
}

/** POST — acepta una invitación (invitado autenticado; puede no tener org activa). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  let session: { userId: string; email: string };
  try {
    session = await requireSession();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { token } = await params;
  const result = await acceptInvitation(token, session);
  if (!result.ok) {
    const e = ACCEPT_ERROR[result.code];
    return Response.json({ error: { code: result.code, message: e.message } }, { status: e.status });
  }
  return Response.json({ ok: true, organizationId: result.organizationId });
}
