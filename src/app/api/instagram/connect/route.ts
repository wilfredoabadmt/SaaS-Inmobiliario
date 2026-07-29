import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { isInstagramConfigured } from "@/lib/env";
import { buildAuthorizeUrl, signState } from "@/server/instagram/oauth";

export const dynamic = "force-dynamic";

/** GET /api/instagram/connect — inicia el OAuth de Instagram (solo owner). DV-IG-2. */
export async function GET() {
  if (!isInstagramConfigured()) {
    return Response.json(
      { error: { code: "ig_not_configured", message: "Instagram no está configurado" } },
      { status: 503 },
    );
  }
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const state = signState(organizationId);
  return Response.redirect(buildAuthorizeUrl(state), 302);
}
