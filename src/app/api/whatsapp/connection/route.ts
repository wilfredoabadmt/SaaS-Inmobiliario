import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getConnectionStatus } from "@/server/whatsapp/credentials";

export const dynamic = "force-dynamic";

/** GET /api/whatsapp/connection — estado de la conexión (sin token). */
export async function GET() {
  try {
    const { organizationId } = await requireMember();
    return Response.json(await getConnectionStatus(organizationId));
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
