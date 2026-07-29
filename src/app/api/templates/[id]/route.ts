import type { NextRequest } from "next/server";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { deleteTemplate, templateErrorPayload } from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

/** DELETE /api/templates/[id] — borra la plantilla en Meta y localmente (FR-007, owner). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  try {
    await deleteTemplate(organizationId, id);
    return Response.json({ deleted: true });
  } catch (e) {
    const { status, body } = templateErrorPayload(e);
    return Response.json(body, { status });
  }
}
