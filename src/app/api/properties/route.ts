import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { propertyCreateSchema } from "@/lib/properties/schemas";
import { createProperty } from "@/server/properties/service";
import { listProperties, type PropertyListFilters } from "@/server/properties/queries";

export const dynamic = "force-dynamic";

/** POST — crea una propiedad del tenant (US1). */
export async function POST(req: NextRequest) {
  let organizationId: string;
  let userId: string;
  try {
    ({ organizationId, userId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = propertyCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const property = await createProperty(organizationId, userId, parsed.data);
  return Response.json({ id: property.id, property }, { status: 201 });
}

/** GET — lista el inventario del tenant (refresco del cliente; el primer render es SSR). */
export async function GET(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const sp = req.nextUrl.searchParams;
  const filters: PropertyListFilters = {
    op: (sp.get("op") as PropertyListFilters["op"]) ?? undefined,
    status: (sp.get("status") as PropertyListFilters["status"]) ?? undefined,
    archived: (sp.get("archived") as PropertyListFilters["archived"]) ?? undefined,
  };
  const properties = await listProperties(organizationId, filters);
  return Response.json({ properties });
}
