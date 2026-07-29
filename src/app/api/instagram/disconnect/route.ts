import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { deleteCredentials } from "@/server/instagram/credentials";

export const dynamic = "force-dynamic";

/** POST /api/instagram/disconnect — elimina la conexión de IG (solo owner). */
export async function POST() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  await deleteCredentials(organizationId);
  return Response.json({ ok: true }, { status: 200 });
}
