import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getAnalytics, parseAnalyticsRange, templateErrorPayload } from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

/** GET /api/templates/[id]/analytics — stats de UNA plantilla en un rango (FR-011, member). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const { start, end } = parseAnalyticsRange(sp.get("start"), sp.get("end"));
  try {
    const result = await getAnalytics(organizationId, { templateId: id, start, end });
    return Response.json(result);
  } catch (e) {
    const { status, body } = templateErrorPayload(e);
    return Response.json(body, { status });
  }
}
