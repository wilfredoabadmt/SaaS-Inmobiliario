import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { listMembers } from "@/server/team/members";

export const dynamic = "force-dynamic";

/** GET — miembros de la organización activa (solo owner). */
export async function GET() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const members = await listMembers(organizationId);
  return Response.json({ members });
}
