import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { dealPatchSchema } from "@/lib/pipeline/schemas";
import { assignDeal, type DealWriteResult, moveDeal } from "@/server/pipeline/deals";
import { getDealDetail } from "@/server/pipeline/queries";

export const dynamic = "force-dynamic";

const notFound = () =>
  Response.json({ error: { code: "not_found", message: "Trato no encontrado" } }, { status: 404 });

/** Mapea un fallo de mutación de trato a su respuesta HTTP. */
function dealError(result: Extract<DealWriteResult, { ok: false }>): Response {
  switch (result.reason) {
    case "invalid_stage":
      return Response.json({ error: { code: "invalid_stage", message: "Etapa inválida" } }, { status: 400 });
    case "not_a_member":
      return Response.json(
        { error: { code: "not_a_member", message: "El agente no es miembro de la organización" } },
        { status: 400 },
      );
    case "not_found":
      return notFound();
    default:
      return Response.json({ error: { code: "invalid", message: "No se pudo actualizar" } }, { status: 400 });
  }
}

/** GET — detalle del trato para el panel lateral (US4). Scoped: otra org → 404. */
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
  const detail = await getDealDetail(organizationId, id);
  if (!detail) return notFound();
  return Response.json(detail);
}

/** PATCH — mueve de etapa (US1) y/o asigna agente (US5). Al menos un campo. Scoped: otra org → 404. */
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
  const parsed = dealPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const { stageId, assignedAgentId } = parsed.data;

  if (stageId !== undefined) {
    const result = await moveDeal(organizationId, id, stageId);
    if (!result.ok) return dealError(result);
  }
  if (assignedAgentId !== undefined) {
    const result = await assignDeal(organizationId, id, assignedAgentId);
    if (!result.ok) return dealError(result);
  }
  return Response.json({ ok: true });
}
