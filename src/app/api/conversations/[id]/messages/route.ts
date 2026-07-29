import type { NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { conversation, message, property } from "@/lib/db/schema/domain";
import type { MessageItem, PropertyView } from "@/lib/inbox/types";
import { buildTextPayload, graphRequest, MetaApiError } from "@/lib/meta";
import { toPropertyView } from "@/server/matching/engine";
import { resolveMainPhotoUrls } from "@/server/properties/photos";
import { getSendingCredentials } from "@/server/whatsapp/credentials";

export const dynamic = "force-dynamic";

async function loadConversation(organizationId: string, conversationId: string) {
  const rows = await getDb()
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, conversationId), eq(conversation.organizationId, organizationId)))
    .limit(1);
  return rows[0] ?? null;
}

/** GET — mensajes del hilo en orden cronológico (FR-003). */
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
  const conv = await loadConversation(organizationId, id);
  if (!conv) {
    return Response.json({ error: { code: "not_found", message: "Conversación no encontrada" } }, { status: 404 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: message.id,
      direction: message.direction,
      body: message.body,
      status: message.status,
      aiGenerated: message.aiGenerated,
      waType: message.waType,
      propertyId: message.propertyId,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(eq(message.conversationId, id))
    .orderBy(asc(message.createdAt));

  // Fichas-tarjeta (feature 006): resolver las propiedades para renderizar la burbuja.
  const propIds = [...new Set(rows.map((r) => r.propertyId).filter((p): p is string => !!p))];
  const propViews = new Map<string, PropertyView>();
  if (propIds.length > 0) {
    const props = await db
      .select()
      .from(property)
      .where(and(eq(property.organizationId, organizationId), inArray(property.id, propIds)));
    for (const p of props) propViews.set(p.id, toPropertyView(p));
    // Foto real de la ficha (URL prefirmada) para renderizarla en el hilo.
    const photoUrls = await resolveMainPhotoUrls(organizationId, propIds);
    for (const [pid, view] of propViews) {
      const url = photoUrls.get(pid);
      if (url) view.photoUrl = url;
    }
  }

  const messages: MessageItem[] = rows.map((m) => {
    const view = m.propertyId ? propViews.get(m.propertyId) : undefined;
    return {
      id: m.id,
      direction: m.direction,
      body: m.body,
      status: m.status,
      aiGenerated: m.aiGenerated,
      waType: m.waType,
      createdAt: m.createdAt.toISOString(),
      ...(view ? { kind: "property" as const, property: view } : {}),
    };
  });

  return Response.json({ messages });
}

const sendSchema = z.object({ body: z.string().min(1).max(4096) });

/** POST — enviar mensaje de texto vía Cloud API y persistir el outbound (FR-003). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  let organizationId: string;
  try {
    ({ userId, organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const conv = await loadConversation(organizationId, id);
  if (!conv) {
    return Response.json({ error: { code: "not_found", message: "Conversación no encontrada" } }, { status: 404 });
  }

  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Mensaje inválido" } }, { status: 422 });
  }

  const creds = await getSendingCredentials(organizationId);
  if (!creds) {
    return Response.json({ error: { code: "not_connected", message: "WhatsApp no conectado" } }, { status: 409 });
  }

  try {
    await graphRequest(
      `${creds.phoneNumberId}/messages`,
      { method: "POST", body: JSON.stringify(buildTextPayload(conv.waContactPhone, parsed.data.body)) },
      creds.token,
    );
  } catch (e) {
    if (e instanceof MetaApiError) {
      // No persistimos el outbound si Meta lo rechazó: el mensaje no salió.
      const meta = e.body as
        | { error?: { code?: number; message?: string; error_data?: { details?: string } } }
        | undefined;
      const code = meta?.error?.code;
      const detail = meta?.error?.error_data?.details ?? meta?.error?.message;
      // Log server-only (sin token) para diagnóstico en Coolify.
      console.error("[send] Meta rechazó el envío", { code, detail });
      const reason: Record<number, string> = {
        0: "el token de Meta venció. Genera un token permanente (System User).",
        190: "el token de Meta venció. Genera un token permanente (System User).",
        131047: "fuera de la ventana de 24 h: usa una plantilla aprobada.",
        131030:
          "el destinatario no está en la lista de números permitidos del número de prueba. Agrégalo en Meta → WhatsApp → API Setup.",
        133010: "el número no está registrado en Cloud API (falta el paso de registro).",
        131026: "el mensaje no se pudo entregar (el destinatario no tiene WhatsApp o no aceptó recibir).",
        100: "parámetro inválido en la petición.",
      };
      const why = (code != null && reason[code]) || "revisa la conexión de WhatsApp.";
      const message = `WhatsApp rechazó el envío${code != null ? ` (código ${code})` : ""}: ${why}`;
      return Response.json(
        { error: { code: "send_failed", metaCode: code ?? null, message } },
        { status: 502 },
      );
    }
    throw e;
  }

  const now = new Date();
  const inserted = await getDb()
    .insert(message)
    .values({
      id: newId("message"),
      organizationId,
      conversationId: id,
      direction: "outbound",
      senderUserId: userId,
      body: parsed.data.body,
      status: "sent",
      waTimestamp: now,
    })
    .returning({ id: message.id });
  await getDb().update(conversation).set({ lastMessageAt: now }).where(eq(conversation.id, id));

  return Response.json({ id: inserted[0]?.id, status: "sent" }, { status: 201 });
}
