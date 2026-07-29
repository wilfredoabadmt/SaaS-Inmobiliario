import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { client } from "@/lib/db/schema/domain";
import { requirementsManualSchema } from "@/lib/properties/schemas";
import { upsertRequirements } from "@/server/requirements/service";

export const dynamic = "force-dynamic";

/** PUT — crea/edita manualmente los requisitos de un cliente (US5, source="manual"). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const parsed = requirementsManualSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Requisitos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  // Scope de tenant: el cliente debe ser de la organización.
  const [row] = await getDb()
    .select({ id: client.id })
    .from(client)
    .where(and(eq(client.id, id), eq(client.organizationId, organizationId)))
    .limit(1);
  if (!row) {
    return Response.json(
      { error: { code: "not_found", message: "Cliente no encontrado" } },
      { status: 404 },
    );
  }

  const requirements = await upsertRequirements(organizationId, id, parsed.data, "manual");
  return Response.json({ requirements });
}
