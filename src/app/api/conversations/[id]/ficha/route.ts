import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { conversation } from "@/lib/db/schema/domain";
import { MetaApiError } from "@/lib/meta";
import { CardSendError, sendPropertyCard } from "@/server/inbox/ficha";

export const dynamic = "force-dynamic";

const schema = z.object({ propertyId: z.string().min(1) });

/**
 * POST — envía la ficha de una propiedad como **tarjeta** (foto + caption + botones) al
 * cliente de la conversación (feature 006). Arregla el botón "Enviar ficha" del panel,
 * que antes solo pintaba una burbuja local. Scope de tenant.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  let userId: string;
  try {
    ({ organizationId, userId } = await requireMember());
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

  const [conv] = await getDb()
    .select({ id: conversation.id, waContactPhone: conversation.waContactPhone })
    .from(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.organizationId, organizationId)))
    .limit(1);
  if (!conv) {
    return Response.json({ error: { code: "not_found", message: "Conversación no encontrada" } }, { status: 404 });
  }

  try {
    await sendPropertyCard(organizationId, conv, parsed.data.propertyId, {
      withButtons: true,
      aiGenerated: false,
      senderUserId: userId,
    });
  } catch (e) {
    if (e instanceof CardSendError) {
      const map = {
        not_found: { status: 404, message: "La propiedad no existe o no es de tu agencia." },
        no_window: {
          status: 409,
          message: "Fuera de la ventana de 24 h: usa una plantilla aprobada para reabrir la conversación.",
        },
        no_creds: { status: 409, message: "WhatsApp no está conectado." },
      } as const;
      const m = map[e.reason];
      return Response.json({ error: { code: e.reason, message: m.message } }, { status: m.status });
    }
    if (e instanceof MetaApiError) {
      // Meta rechazó el envío (p. ej. el header de imagen). Surfacearlo claro, no 500 mudo.
      const meta = e.body as { error?: { code?: number; message?: string } } | undefined;
      const code = meta?.error?.code ?? null;
      console.error("[ficha] Meta rechazó la tarjeta", { code, detail: meta?.error?.message });
      return Response.json(
        {
          error: {
            code: "send_failed",
            metaCode: code,
            message: `WhatsApp rechazó la tarjeta${code != null ? ` (código ${code})` : ""}: ${meta?.error?.message ?? "revisa el formato de imagen/interactivo."}`,
          },
        },
        { status: 502 },
      );
    }
    throw e;
  }

  return Response.json({ status: "sent" }, { status: 201 });
}
