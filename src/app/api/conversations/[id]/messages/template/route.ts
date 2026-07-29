import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { conversation, message, template } from "@/lib/db/schema/domain";
import { graphRequest, normalizeRecipient } from "@/lib/meta";
import {
  buildSendComponents,
  countVariables,
  renderBody,
  type TemplateComponents,
} from "@/lib/meta/templates";
import { getSendingCredentials } from "@/server/whatsapp/credentials";

export const dynamic = "force-dynamic";

const schema = z.object({
  templateId: z.string().min(1),
  variables: z.array(z.string()).optional(),
});

/**
 * POST — envía una plantilla APROBADA por la conversación, rellenando sus variables (feature 012,
 * FR-008/009/010). Es la vía válida fuera de la ventana de 24 h. Solo plantillas APPROVED; valida
 * que el nº de variables coincida; renderiza el cuerpo en el hilo.
 */
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
  const convRows = await getDb()
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.organizationId, organizationId)))
    .limit(1);
  const conv = convRows[0];
  if (!conv) {
    return Response.json({ error: { code: "not_found", message: "Conversación no encontrada" } }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Solicitud inválida" } }, { status: 422 });
  }

  const tplRows = await getDb()
    .select()
    .from(template)
    .where(and(eq(template.id, parsed.data.templateId), eq(template.organizationId, organizationId)))
    .limit(1);
  const tpl = tplRows[0];
  if (!tpl) {
    return Response.json({ error: { code: "not_found", message: "Plantilla no encontrada" } }, { status: 404 });
  }
  if (tpl.status !== "APPROVED") {
    return Response.json({ error: { code: "invalid", message: "La plantilla no está aprobada" } }, { status: 422 });
  }

  const comps = tpl.components as TemplateComponents | null;
  const bodyVars = comps?.body?.variables ?? countVariables(tpl.body);
  const variables = parsed.data.variables ?? [];
  if (variables.length !== bodyVars || variables.some((v) => !v.trim())) {
    return Response.json(
      { error: { code: "invalid", message: `Faltan valores para las ${bodyVars} variables` } },
      { status: 422 },
    );
  }

  const creds = await getSendingCredentials(organizationId);
  if (!creds) {
    return Response.json({ error: { code: "not_connected", message: "WhatsApp no conectado" } }, { status: 409 });
  }

  const sendComponents = buildSendComponents(variables);
  try {
    await graphRequest(
      `${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizeRecipient(conv.waContactPhone),
          type: "template",
          template: {
            name: tpl.waTemplateName,
            language: { code: tpl.language },
            ...(sendComponents.length > 0 ? { components: sendComponents } : {}),
          },
        }),
      },
      creds.token,
    );
  } catch {
    return Response.json({ error: { code: "meta_error", message: "WhatsApp rechazó el envío" } }, { status: 422 });
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
      body: renderBody(tpl.body, variables),
      templateId: tpl.id,
      status: "sent",
      waTimestamp: now,
    })
    .returning({ id: message.id });
  await getDb().update(conversation).set({ lastMessageAt: now }).where(eq(conversation.id, id));

  return Response.json({ id: inserted[0]?.id, status: "sent" }, { status: 201 });
}
