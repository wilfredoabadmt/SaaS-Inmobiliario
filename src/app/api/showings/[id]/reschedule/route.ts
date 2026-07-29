import type { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { rescheduleShowing } from "@/server/showings/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ whenISO: z.string().min(1) });

/** POST /api/showings/[id]/reschedule — mueve la visita a otro slot disponible. */
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
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "whenISO requerido" } }, { status: 400 });
  }
  const result = await rescheduleShowing(organizationId, id, parsed.data.whenISO);
  if (result.ok) return Response.json({ ok: true });
  if (result.code === "not_found") {
    return Response.json({ error: { code: "not_found", message: "Visita no encontrada" } }, { status: 404 });
  }
  return Response.json(
    { error: { code: "slot_taken", message: "Ese horario ya no está disponible" } },
    { status: 409 },
  );
}
