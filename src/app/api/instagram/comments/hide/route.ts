import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { commentHideSchema } from "@/lib/instagram/schemas";
import { deleteComment, hideComment } from "@/server/instagram/comments";
import {
  getConnectedCredentials,
  mapInstagramError,
  notConnectedResponse,
} from "@/server/instagram/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/instagram/comments/hide — oculta o borra un comentario. owner+agent. */
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireMember();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const parsed = commentHideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Cuerpo inválido" } }, { status: 422 });
  }
  const cr = await getConnectedCredentials(ctx.organizationId);
  if (!cr.ok) return notConnectedResponse(cr.code);
  try {
    if (parsed.data.action === "delete") {
      await deleteComment(cr.creds.token, parsed.data.commentId);
    } else {
      await hideComment(cr.creds.token, parsed.data.commentId);
    }
    return Response.json({ ok: true }, { status: 200 });
  } catch (e) {
    return mapInstagramError(ctx.organizationId, e);
  }
}
