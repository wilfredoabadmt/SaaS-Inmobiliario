import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { conversation } from "@/lib/db/schema/domain";

export const dynamic = "force-dynamic";

const schema = z.union([
  z.object({ enabled: z.boolean() }),
  z.object({ resume: z.literal(true) }),
]);

/**
 * POST — activa/desactiva el agente de IA por conversación (opt-in, FR-005) o
 * reanuda tras un handoff (`resume` → needs_human=false). Scope de tenant.
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
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Solicitud inválida" } }, { status: 422 });
  }

  // Reanudar limpia needs_human Y el motivo (feature 005); activar/desactivar solo el flag.
  const set =
    "enabled" in parsed.data
      ? { aiEnabled: parsed.data.enabled }
      : { needsHuman: false, needsHumanReason: null, aiEnabled: true };

  const updated = await getDb()
    .update(conversation)
    .set(set)
    .where(and(eq(conversation.id, id), eq(conversation.organizationId, organizationId)))
    .returning({
      aiEnabled: conversation.aiEnabled,
      needsHuman: conversation.needsHuman,
      needsHumanReason: conversation.needsHumanReason,
    });

  if (!updated[0]) {
    return Response.json({ error: { code: "not_found", message: "Conversación no encontrada" } }, { status: 404 });
  }
  return Response.json(updated[0]);
}
