import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { showing } from "@/lib/db/schema/domain";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ status: z.enum(["realizada", "no_show"]) });

/** PATCH /api/showings/[id]/status — cierra la visita (realizada/no_show). No toca Google. */
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
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Estado inválido" } }, { status: 400 });
  }
  const result = await getDb()
    .update(showing)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(and(eq(showing.id, id), eq(showing.organizationId, organizationId)))
    .returning({ id: showing.id });
  if (result.length === 0) {
    return Response.json({ error: { code: "not_found", message: "Visita no encontrada" } }, { status: 404 });
  }
  return Response.json({ ok: true });
}
