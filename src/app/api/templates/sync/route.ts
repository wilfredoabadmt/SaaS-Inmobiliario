import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { syncTemplates, templateErrorPayload } from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

/** POST /api/templates/sync — reconcilia el estatus de las plantillas desde Meta (FR-005, owner). */
export async function POST() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  try {
    const result = await syncTemplates(organizationId);
    return Response.json(result);
  } catch (e) {
    const { status, body } = templateErrorPayload(e);
    return Response.json(body, { status });
  }
}
