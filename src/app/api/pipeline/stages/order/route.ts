import type { NextRequest } from "next/server";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { stageReorderSchema } from "@/lib/pipeline/schemas";
import { reorderStages } from "@/server/pipeline/stages";

export const dynamic = "force-dynamic";

/** PUT — reordena atómicamente las etapas de la org (solo owner). */
export async function PUT(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = stageReorderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const result = await reorderStages(organizationId, parsed.data.orderedIds);
  if (!result.ok) {
    return Response.json(
      { error: { code: "invalid_order", message: "El orden debe contener exactamente las etapas de la agencia" } },
      { status: 400 },
    );
  }
  return Response.json({ ok: true });
}
