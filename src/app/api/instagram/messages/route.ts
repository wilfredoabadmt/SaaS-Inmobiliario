import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { sendDmSchema } from "@/lib/instagram/schemas";
import { isWithinWindow, lastInboundAt, recordOutboundDm, sendDm } from "@/server/instagram/messaging";
import {
  getConnectedCredentials,
  mapInstagramError,
  notConnectedResponse,
} from "@/server/instagram/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/instagram/messages — enviar un DM dentro de la ventana de 24 h. owner+agent. */
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireMember();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const parsed = sendDmSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Cuerpo inválido" } }, { status: 422 });
  }
  const { recipientIgsid, text } = parsed.data;

  const cr = await getConnectedCredentials(ctx.organizationId);
  if (!cr.ok) return notConnectedResponse(cr.code);

  const lastIn = await lastInboundAt(ctx.organizationId, recipientIgsid);
  if (!isWithinWindow(lastIn)) {
    return Response.json(
      {
        error: {
          code: "outside_24h_window",
          message: "Fuera de la ventana de 24 h: no se puede enviar un mensaje estándar.",
        },
      },
      { status: 422 },
    );
  }

  try {
    await sendDm(cr.creds.token, cr.creds.igUserId, recipientIgsid, text);
    await recordOutboundDm({ organizationId: ctx.organizationId, counterpartyIgsid: recipientIgsid, text });
    return Response.json({ ok: true }, { status: 200 });
  } catch (e) {
    return mapInstagramError(ctx.organizationId, e);
  }
}
