import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getClientDetail } from "@/server/clients/service";
import { getOrCreateConversation } from "@/server/inbox/conversations";

export const dynamic = "force-dynamic";

/**
 * POST — resuelve (get-or-create) la conversación del contacto para el atajo "Enviar
 * mensaje" (US4, DV-CM-2/3/5). NO envía nada ni aplica reglas de canal: solo devuelve el
 * `conversationId` para hacer deep-link a `/inbox?c=<id>`, donde la bandeja decide texto
 * libre vs. plantilla según la ventana de 24h.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const contact = await getClientDetail(organizationId, id);
  if (!contact) {
    return Response.json(
      { error: { code: "not_found", message: "Contacto no encontrado" } },
      { status: 404 },
    );
  }

  const conv = await getOrCreateConversation(organizationId, contact.id, contact.phone);
  return Response.json({ conversationId: conv.id });
}
