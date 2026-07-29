import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getStatusView } from "@/server/calendar/google";

export const dynamic = "force-dynamic";

/** GET /api/calendar/google/status — estado de conexión de Google del asesor actual (sin token). */
export async function GET() {
  let userId: string, organizationId: string;
  try {
    ({ userId, organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const view = await getStatusView(organizationId, userId);
  return Response.json(view);
}
