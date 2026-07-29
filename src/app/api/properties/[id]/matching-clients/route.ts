import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getPropertyDetail } from "@/server/properties/service";
import { matchClientsForProperty } from "@/server/matching/queries";

export const dynamic = "force-dynamic";

/** GET — clientes del tenant que hacen match con la propiedad (match inverso, US4). */
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
  // Scope de tenant: si la propiedad no es del tenant, 404 (no se filtra cross-tenant).
  const property = await getPropertyDetail(organizationId, id);
  if (!property) {
    return Response.json(
      { error: { code: "not_found", message: "Propiedad no encontrada" } },
      { status: 404 },
    );
  }

  const clients = await matchClientsForProperty(organizationId, id);
  return Response.json({ propertyId: id, clients });
}
