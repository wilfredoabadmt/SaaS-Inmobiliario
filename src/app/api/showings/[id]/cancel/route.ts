import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { cancelShowing } from "@/server/showings/service";

export const dynamic = "force-dynamic";

/** POST /api/showings/[id]/cancel — cancela la visita (borra el evento de Google + email). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const { id } = await params;
  const result = await cancelShowing(organizationId, id);
  if (result.ok) return Response.json({ ok: true });
  return Response.json({ error: { code: "not_found", message: "Visita no encontrada" } }, { status: 404 });
}
