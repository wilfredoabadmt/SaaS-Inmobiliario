import type { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { requirementsToView } from "@/server/matching/queries";
import {
  clientIdForConversation,
  getRequirements,
  upsertRequirements,
} from "@/server/requirements/service";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  operation: z.enum(["renta", "venta"]).nullish(),
  budgetMin: z.number().nonnegative().nullish(),
  budgetMax: z.number().nonnegative().nullish(),
  zone: z.string().max(120).nullish(),
  propertyType: z.enum(["casa", "departamento", "local", "terreno"]).nullish(),
  bedrooms: z.number().int().min(0).max(20).nullish(),
  bathrooms: z.number().min(0).max(20).nullish(),
  notes: z.string().max(1000).nullish(),
});

async function resolve(organizationId: string, conversationId: string) {
  const clientId = await clientIdForConversation(organizationId, conversationId);
  return clientId;
}

/** GET — requisitos actuales del cliente de la conversación. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const { id } = await params;
  const clientId = await resolve(organizationId, id);
  if (!clientId) {
    return Response.json({ error: { code: "not_found", message: "Conversación no encontrada" } }, { status: 404 });
  }
  const row = await getRequirements(organizationId, clientId);
  return Response.json({ requirements: row ? requirementsToView(row) : null });
}

/** PUT — el asesor edita los requisitos (source manual; sube version, invalida caché). */
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
  const clientId = await resolve(organizationId, id);
  if (!clientId) {
    return Response.json({ error: { code: "not_found", message: "Conversación no encontrada" } }, { status: 404 });
  }
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Requisitos inválidos" } }, { status: 422 });
  }
  const row = await upsertRequirements(organizationId, clientId, parsed.data, "manual");
  return Response.json({ requirements: requirementsToView(row) });
}
