import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { listRecentMedia } from "@/server/instagram/media";
import {
  getConnectedCredentials,
  mapInstagramError,
  notConnectedResponse,
} from "@/server/instagram/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/instagram/media — publicaciones recientes para elegir cuál moderar. owner+agent. */
export async function GET() {
  let ctx;
  try {
    ctx = await requireMember();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const cr = await getConnectedCredentials(ctx.organizationId);
  if (!cr.ok) return notConnectedResponse(cr.code);
  try {
    const media = await listRecentMedia(cr.creds.token, cr.creds.igUserId);
    return Response.json({ media }, { status: 200 });
  } catch (e) {
    return mapInstagramError(ctx.organizationId, e);
  }
}
