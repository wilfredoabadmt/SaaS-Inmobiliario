import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { listConversations } from "@/server/inbox/queries";

export const dynamic = "force-dynamic";

/** GET /api/conversations — bandeja (scope de tenant, orden por último mensaje, FR-002). */
export async function GET() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const conversations = await listConversations(organizationId);
  return Response.json({ conversations });
}
