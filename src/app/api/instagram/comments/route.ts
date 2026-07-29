import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { listComments } from "@/server/instagram/comments";
import {
  getConnectedCredentials,
  mapInstagramError,
  notConnectedResponse,
} from "@/server/instagram/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/instagram/comments?mediaId= — lista comentarios de una publicación. owner+agent. */
export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireMember();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const mediaId = new URL(req.url).searchParams.get("mediaId");
  if (!mediaId) {
    return Response.json({ error: { code: "invalid", message: "Falta mediaId" } }, { status: 422 });
  }
  const cr = await getConnectedCredentials(ctx.organizationId);
  if (!cr.ok) return notConnectedResponse(cr.code);
  try {
    const comments = await listComments(cr.creds.token, mediaId);
    return Response.json({ comments }, { status: 200 });
  } catch (e) {
    return mapInstagramError(ctx.organizationId, e);
  }
}
