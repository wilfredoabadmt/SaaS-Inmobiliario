import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { clientArchiveSchema } from "@/lib/clients/schemas";
import { setArchived } from "@/server/clients/service";

export const dynamic = "force-dynamic";

/**
 * POST — archiva/desarchiva un contacto del tenant (feature 009, soft-delete reversible).
 * Body: `{ archived: boolean }`. No borra datos: conserva conversación/historial/contratos.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const parsed = clientArchiveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const ok = await setArchived(organizationId, id, parsed.data.archived);
  if (!ok) {
    return Response.json(
      { error: { code: "not_found", message: "Contacto no encontrado" } },
      { status: 404 },
    );
  }
  return Response.json({ id, archived: parsed.data.archived });
}
