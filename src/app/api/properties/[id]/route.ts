import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { propertyUpdateSchema } from "@/lib/properties/schemas";
import { getPropertyDetail, updateProperty } from "@/server/properties/service";

export const dynamic = "force-dynamic";

const notFound = () =>
  Response.json(
    { error: { code: "not_found", message: "Propiedad no encontrada" } },
    { status: 404 },
  );

/** GET — detalle completo + galería de la propiedad del tenant. */
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
  const property = await getPropertyDetail(organizationId, id);
  if (!property) return notFound();
  return Response.json(property);
}

/** PATCH — edita parcialmente la propiedad del tenant (US1). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const parsed = propertyUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const property = await updateProperty(organizationId, id, parsed.data);
  if (!property) return notFound();
  return Response.json({ property });
}
