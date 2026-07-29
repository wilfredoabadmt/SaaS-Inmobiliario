import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { listConversations } from "@/server/instagram/messaging";
import {
  getConnectedCredentials,
  mapInstagramError,
  notConnectedResponse,
} from "@/server/instagram/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/instagram/conversations — hilos de DM en vivo. owner+agent. */
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
    const threads = await listConversations(cr.creds.token, cr.creds.igUserId);
    return Response.json({ threads }, { status: 200 });
  } catch (e) {
    return mapInstagramError(ctx.organizationId, e);
  }
}
