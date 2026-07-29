import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember, requireOwner } from "@/lib/auth/guards";
import { organizationUpdateSchema } from "@/lib/organization/schemas";
import { getOrganization, updateOrganizationName } from "@/server/organization/settings";

export const dynamic = "force-dynamic";

/** GET — datos de la organización activa (cualquier miembro puede leer). */
export async function GET() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const org = await getOrganization(organizationId);
  if (!org) {
    return Response.json(
      { error: { code: "not_found", message: "Organización no encontrada" } },
      { status: 404 },
    );
  }
  return Response.json(org);
}

/** PUT — actualiza el nombre de la agencia (solo owner). */
export async function PUT(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = organizationUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Nombre inválido", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  await updateOrganizationName(organizationId, parsed.data.name);
  return Response.json({ ok: true, name: parsed.data.name });
}
