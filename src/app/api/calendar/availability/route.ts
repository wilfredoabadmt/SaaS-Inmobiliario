import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { member } from "@/lib/db/schema/auth";
import { computeAvailability } from "@/server/calendar/availability";

export const dynamic = "force-dynamic";

const MAX_WINDOW_MS = 14 * 24 * 3_600_000;

/** GET /api/calendar/availability?from&to&agentId? — slots libres del asesor. */
export async function GET(req: NextRequest) {
  let userId: string, organizationId: string;
  try {
    ({ userId, organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const agentId = url.searchParams.get("agentId") ?? userId;

  const now = Date.now();
  const fromMs = fromParam ? Date.parse(fromParam) : now;
  const toMs = toParam ? Date.parse(toParam) : now + 7 * 24 * 3_600_000;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return Response.json(
      { error: { code: "invalid_range", message: "Rango de fechas inválido" } },
      { status: 400 },
    );
  }
  const to = Math.min(toMs, fromMs + MAX_WINDOW_MS);

  // El agentId solicitado debe ser miembro de la misma organización (aislamiento).
  if (agentId !== userId) {
    const [m] = await getDb()
      .select({ userId: member.userId })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, agentId)))
      .limit(1);
    if (!m) {
      return Response.json(
        { error: { code: "not_found", message: "Asesor no encontrado en la organización" } },
        { status: 404 },
      );
    }
  }

  const result = await computeAvailability(
    organizationId,
    agentId,
    new Date(fromMs).toISOString(),
    new Date(to).toISOString(),
  );
  return Response.json(result);
}
