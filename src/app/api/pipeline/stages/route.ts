import type { NextRequest } from "next/server";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { stageCreateSchema } from "@/lib/pipeline/schemas";
import { createStage, listStages } from "@/server/pipeline/stages";

export const dynamic = "force-dynamic";

/** GET — etapas de la org para el modo de configuración (solo owner). */
export async function GET() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const stages = await listStages(organizationId);
  return Response.json({ stages });
}

/** POST — crea una etapa intermedia (solo owner). */
export async function POST(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = stageCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const result = await createStage(organizationId, parsed.data);
  if (!result.ok) {
    return Response.json(
      { error: { code: "invalid_after", message: "Etapa de referencia inválida" } },
      { status: 400 },
    );
  }
  return Response.json({ id: result.id }, { status: 201 });
}
