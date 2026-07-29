import type { NextRequest } from "next/server";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { roleUpdateSchema } from "@/lib/team/schemas";
import { changeRole, removeMember, type TeamMutationResult } from "@/server/team/members";

export const dynamic = "force-dynamic";

const ERROR_RESPONSE: Record<"not_found" | "last_owner", { status: number; message: string }> = {
  not_found: { status: 404, message: "Ese usuario no es miembro de tu agencia" },
  last_owner: { status: 409, message: "La agencia debe conservar al menos un dueño" },
};

function toResponse(result: TeamMutationResult): Response {
  if (result.ok) return Response.json({ ok: true });
  const e = ERROR_RESPONSE[result.code];
  return Response.json({ error: { code: result.code, message: e.message } }, { status: e.status });
}

async function owner(): Promise<{ organizationId: string } | Response> {
  try {
    return await requireOwner();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

/** PATCH — cambia el rol de un miembro (solo owner). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await owner();
  if (ctx instanceof Response) return ctx;
  const { userId } = await params;

  const parsed = roleUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Rol inválido" } },
      { status: 422 },
    );
  }
  return toResponse(await changeRole(ctx.organizationId, userId, parsed.data.role));
}

/** DELETE — elimina un miembro de la organización (solo owner). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await owner();
  if (ctx instanceof Response) return ctx;
  const { userId } = await params;
  return toResponse(await removeMember(ctx.organizationId, userId));
}
