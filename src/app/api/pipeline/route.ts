import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getBoard } from "@/server/pipeline/board";

export const dynamic = "force-dynamic";

/** GET — tablero del pipeline de la org (etapas + tratos). Refresco del cliente; el 1er render es SSR. */
export async function GET() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const board = await getBoard(organizationId);
  return Response.json(board);
}
