import type { NextRequest } from "next/server";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { stagePatchSchema } from "@/lib/pipeline/schemas";
import { deleteStage, renameStage } from "@/server/pipeline/stages";

export const dynamic = "force-dynamic";

const notFound = () =>
  Response.json({ error: { code: "not_found", message: "Etapa no encontrada" } }, { status: 404 });

/** PATCH — renombra una etapa (solo owner; permitido también para anclas). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const parsed = stagePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const result = await renameStage(organizationId, id, parsed.data.label);
  if (!result.ok) return notFound();
  return Response.json({ ok: true });
}

/** DELETE — elimina una etapa intermedia (solo owner). Anclas → 400; con tratos → 409. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const reassignToStageId = req.nextUrl.searchParams.get("reassignToStageId");
  const result = await deleteStage(organizationId, id, reassignToStageId);
  if (!result.ok) {
    switch (result.reason) {
      case "not_found":
        return notFound();
      case "anchor_stage":
        return Response.json(
          { error: { code: "anchor_stage", message: "Las etapas Ganado/Perdido/Visita agendada no se eliminan" } },
          { status: 400 },
        );
      case "invalid_reassign":
        return Response.json(
          { error: { code: "invalid_reassign", message: "Etapa de reubicación inválida" } },
          { status: 400 },
        );
      case "stage_not_empty":
        return Response.json(
          {
            error: {
              code: "stage_not_empty",
              message: "La etapa tiene tratos; reubícalos antes de eliminar",
              dealCount: result.dealCount,
            },
          },
          { status: 409 },
        );
    }
  }
  return Response.json({ ok: true, reassigned: result.ok ? result.reassigned : 0 });
}
