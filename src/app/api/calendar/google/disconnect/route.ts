import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { disconnect } from "@/server/calendar/google";

export const dynamic = "force-dynamic";

/** POST /api/calendar/google/disconnect — desconecta Google Calendar del asesor actual. */
export async function POST() {
  let userId: string, organizationId: string;
  try {
    ({ userId, organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  await disconnect(organizationId, userId);
  return Response.json({ ok: true });
}
