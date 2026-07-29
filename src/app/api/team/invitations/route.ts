import type { NextRequest } from "next/server";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { inviteSchema } from "@/lib/team/schemas";
import { createInvitation, listInvitations } from "@/server/team/invitations";

export const dynamic = "force-dynamic";

const DUP_MESSAGE: Record<"already_member" | "already_invited", string> = {
  already_member: "Esa persona ya es miembro de tu agencia",
  already_invited: "Esa persona ya tiene una invitación pendiente",
};

/** GET — invitaciones pendientes (solo owner). */
export async function GET() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const invitations = await listInvitations(organizationId);
  return Response.json({ invitations });
}

/** POST — invita por email + rol (solo owner). Email best-effort → enlace copiable. */
export async function POST(req: NextRequest) {
  let organizationId: string;
  let userId: string;
  try {
    ({ organizationId, userId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = inviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Correo o rol inválido" } },
      { status: 422 },
    );
  }

  const result = await createInvitation(organizationId, userId, parsed.data.email, parsed.data.role);
  if (!result.ok) {
    const code = result.code!;
    return Response.json({ error: { code, message: DUP_MESSAGE[code] } }, { status: 409 });
  }
  return Response.json(
    { invitation: result.invitation, acceptUrl: result.acceptUrl, emailSent: result.emailSent },
    { status: 201 },
  );
}
