import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { archiveSchema } from "@/lib/properties/schemas";
import { setArchived } from "@/server/properties/service";

export const dynamic = "force-dynamic";

/** POST — archiva (soft-delete) o desarchiva la propiedad del tenant (US2). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const parsed = archiveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Solicitud inválida" } }, { status: 422 });
  }

  const result = await setArchived(organizationId, id, parsed.data.archived);
  if (!result) {
    return Response.json(
      { error: { code: "not_found", message: "Propiedad no encontrada" } },
      { status: 404 },
    );
  }
  return Response.json({
    archived: parsed.data.archived,
    archivedAt: result.archivedAt ? result.archivedAt.toISOString() : null,
  });
}
