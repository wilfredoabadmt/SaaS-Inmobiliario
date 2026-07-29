import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { commentReplySchema } from "@/lib/instagram/schemas";
import { replyComment } from "@/server/instagram/comments";
import {
  getConnectedCredentials,
  mapInstagramError,
  notConnectedResponse,
} from "@/server/instagram/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/instagram/comments/reply — responde a un comentario. owner+agent. */
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireMember();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const parsed = commentReplySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Cuerpo inválido" } }, { status: 422 });
  }
  const cr = await getConnectedCredentials(ctx.organizationId);
  if (!cr.ok) return notConnectedResponse(cr.code);
  try {
    const id = await replyComment(cr.creds.token, parsed.data.commentId, parsed.data.message);
    return Response.json({ id }, { status: 200 });
  } catch (e) {
    return mapInstagramError(ctx.organizationId, e);
  }
}
