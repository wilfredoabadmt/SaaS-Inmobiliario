import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { isGoogleCalendarConfigured } from "@/lib/env";
import { buildAuthorizeUrl } from "@/lib/google";
import { signState } from "@/lib/google/state";

export const dynamic = "force-dynamic";

/** GET /api/calendar/google/connect — inicia el OAuth de Google del asesor actual. */
export async function GET() {
  if (!isGoogleCalendarConfigured()) {
    return Response.json(
      { error: { code: "google_not_configured", message: "Google Calendar no está configurado" } },
      { status: 501 },
    );
  }
  let userId: string, organizationId: string;
  try {
    ({ userId, organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const state = signState(organizationId, userId);
  return Response.redirect(buildAuthorizeUrl(state), 302);
}
