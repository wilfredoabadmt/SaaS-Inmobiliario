import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getAnalytics, parseAnalyticsRange, templateErrorPayload } from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

/** GET /api/templates/analytics — resumen agregado de la agencia en un rango (FR-012, member). */
export async function GET(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const sp = req.nextUrl.searchParams;
  const { start, end } = parseAnalyticsRange(sp.get("start"), sp.get("end"));
  try {
    const result = await getAnalytics(organizationId, { start, end });
    return Response.json(result);
  } catch (e) {
    const { status, body } = templateErrorPayload(e);
    return Response.json(body, { status });
  }
}
