import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { statusSchema } from "@/lib/properties/schemas";
import { setStatus } from "@/server/properties/service";

export const dynamic = "force-dynamic";

/** PATCH — cambia el estatus de la propiedad (acción rápida, US2). */
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
  const parsed = statusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Estatus inválido" } }, { status: 422 });
  }

  const ok = await setStatus(organizationId, id, parsed.data.status);
  if (!ok) {
    return Response.json(
      { error: { code: "not_found", message: "Propiedad no encontrada" } },
      { status: 404 },
    );
  }
  return Response.json({ status: parsed.data.status });
}
