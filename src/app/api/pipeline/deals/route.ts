import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { dealCreateSchema } from "@/lib/pipeline/schemas";
import { createDeal } from "@/server/pipeline/deals";

export const dynamic = "force-dynamic";

/** POST — alta manual de un trato del tenant (US1). */
export async function POST(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = dealCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const result = await createDeal(organizationId, parsed.data);
  if (!result.ok) {
    switch (result.reason) {
      case "client_not_found":
        return Response.json(
          { error: { code: "not_found", message: "Cliente no encontrado" } },
          { status: 404 },
        );
      case "property_not_found":
        return Response.json(
          { error: { code: "not_found", message: "Propiedad no encontrada" } },
          { status: 404 },
        );
      case "invalid_stage":
        return Response.json(
          { error: { code: "invalid_stage", message: "Etapa inválida" } },
          { status: 400 },
        );
      case "duplicate_deal":
        return Response.json(
          { error: { code: "duplicate_deal", message: "Ya existe un trato para ese cliente/propiedad" } },
          { status: 409 },
        );
      default:
        return Response.json({ error: { code: "invalid", message: "No se pudo crear" } }, { status: 400 });
    }
  }
  return Response.json({ id: result.id, stageId: result.stageId }, { status: 201 });
}
