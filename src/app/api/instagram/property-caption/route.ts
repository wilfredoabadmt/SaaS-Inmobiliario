import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getPropertyPublishPreview } from "@/server/instagram/publish";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/property-caption?propertyId= — caption derivado + si la propiedad tiene
 * foto, para pre-rellenar el compositor "Publicar propiedad". owner+agent, scoped por tenant.
 */
export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireMember();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const propertyId = new URL(req.url).searchParams.get("propertyId");
  if (!propertyId) {
    return Response.json({ error: { code: "invalid", message: "Falta propertyId" } }, { status: 422 });
  }
  const preview = await getPropertyPublishPreview(ctx.organizationId, propertyId);
  if (!preview.ok) {
    return Response.json(
      { error: { code: "not_found", message: "Propiedad no encontrada" } },
      { status: 404 },
    );
  }
  return Response.json({ caption: preview.caption, hasPhoto: preview.hasPhoto }, { status: 200 });
}
