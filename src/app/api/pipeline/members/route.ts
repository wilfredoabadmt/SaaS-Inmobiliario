import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { listOrgMembers } from "@/server/pipeline/queries";

export const dynamic = "force-dynamic";

/** GET — miembros de la org activa (US5), para el selector de asignación de tratos. */
export async function GET() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const members = await listOrgMembers(organizationId);
  return Response.json({ members });
}
