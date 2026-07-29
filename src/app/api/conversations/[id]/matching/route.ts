import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getConversationMatching } from "@/server/matching/queries";

export const dynamic = "force-dynamic";

/** GET — requisitos + ranking real de la conversación (panel "Matching en vivo", US1). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const { id } = await params;
  const data = await getConversationMatching(organizationId, id);
  return Response.json(data);
}
