import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { user } from "@/lib/db/schema/auth";
import {
  candidacy,
  client,
  conversation,
  message,
  property,
  showing,
  template,
} from "@/lib/db/schema/domain";
import { graphRequest, normalizeRecipient } from "@/lib/meta";
import { buildSendComponents, renderBody, type TemplateComponents } from "@/lib/meta/templates";
import { getSendingCredentials } from "@/server/whatsapp/credentials";
import { getSettings } from "@/server/calendar/settings";
import { labelInTz } from "@/lib/time/slots";

/**
 * Escanea visitas agendadas próximas (dentro de la ventana de 24h o con remind_at vencido)
 * y envía el recordatorio por WhatsApp al cliente prospecto (Feature 016).
 * Idempotente: sella `showing.reminder_wa_sent_at` tras procesar.
 */
export async function sendDueClientWaReminders(): Promise<{
  sent: number;
  scanned: number;
  skipped: number;
}> {
  const db = getDb();
  const now = new Date();
  const horizon24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Selecciona citas agendadas pendientes de recordatorio por WhatsApp
  const due = await db
    .select({
      id: showing.id,
      organizationId: showing.organizationId,
      agentId: showing.agentId,
      scheduledAt: showing.scheduledAt,
      clientId: candidacy.clientId,
      clientName: client.name,
      clientPhone: client.phone,
      propTitle: property.title,
      agentName: user.name,
    })
    .from(showing)
    .innerJoin(property, eq(showing.propertyId, property.id))
    .leftJoin(candidacy, eq(showing.candidacyId, candidacy.id))
    .leftJoin(client, eq(candidacy.clientId, client.id))
    .leftJoin(user, eq(showing.agentId, user.id))
    .where(
      and(
        eq(showing.status, "agendada"),
        isNull(showing.reminderWaSentAt),
        gt(showing.scheduledAt, now),
        or(
          and(sql`${showing.remindAt} IS NOT NULL`, lte(showing.remindAt, now)),
          lte(showing.scheduledAt, horizon24h),
        ),
      ),
    )
    .limit(25);

  let sent = 0;
  let skipped = 0;

  for (const row of due) {
    // Sellar siempre para evitar reintentos infinitos si falla
    await db
      .update(showing)
      .set({ reminderWaSentAt: new Date() })
      .where(eq(showing.id, row.id));

    if (!row.clientPhone || !row.clientId) {
      skipped += 1;
      continue;
    }

    const creds = await getSendingCredentials(row.organizationId);
    if (!creds) {
      // Agencia no tiene WhatsApp conectado
      skipped += 1;
      continue;
    }

    // Resolver conversación activa del cliente en la agencia
    let conv = (
      await db
        .select()
        .from(conversation)
        .where(
          and(
            eq(conversation.organizationId, row.organizationId),
            eq(conversation.clientId, row.clientId),
          ),
        )
        .limit(1)
    )[0];

    if (!conv) {
      const convId = newId("conversation");
      await db.insert(conversation).values({
        id: convId,
        organizationId: row.organizationId,
        clientId: row.clientId,
        waContactPhone: row.clientPhone,
        assignedAgentId: row.agentId,
        lastMessageAt: new Date(),
      });
      conv = (
        await db.select().from(conversation).where(eq(conversation.id, convId)).limit(1)
      )[0];
    }

    if (!conv) {
      skipped += 1;
      continue;
    }

    // Obtener zona horaria del asesor para formatear la fecha
    const settings = await getSettings(row.organizationId, row.agentId);
    const dateFormatted = labelInTz(row.scheduledAt.toISOString(), settings.timezone);

    // Buscar si la agencia tiene una plantilla aprobada para visitas
    const [tpl] = await db
      .select()
      .from(template)
      .where(
        and(
          eq(template.organizationId, row.organizationId),
          eq(template.status, "APPROVED"),
          or(
            sql`${template.name} ILIKE '%recordatorio%'`,
            sql`${template.waTemplateName} ILIKE '%recordatorio%'`,
            sql`${template.name} ILIKE '%visita%'`,
            sql`${template.category} = 'UTILITY'`,
          ),
        ),
      )
      .limit(1);

    const clientName = row.clientName ?? "Hola";
    const propertyTitle = row.propTitle ?? "la propiedad";
    const agentName = row.agentName ?? "tu asesor";

    try {
      let sentBody = "";
      if (tpl) {
        // Enviar vía Plantilla de Meta (válida dentro o fuera de 24h)
        const comps = tpl.components as TemplateComponents | null;
        const varCount = comps?.body?.variables ?? 1;

        const vars: string[] = [];
        if (varCount >= 1) vars.push(clientName);
        if (varCount >= 2) vars.push(propertyTitle);
        if (varCount >= 3) vars.push(dateFormatted);
        if (varCount >= 4) vars.push(agentName);
        while (vars.length < varCount) vars.push("info");

        const sendComponents = buildSendComponents(vars);
        await graphRequest(
          `${creds.phoneNumberId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: normalizeRecipient(row.clientPhone),
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
        sentBody = renderBody(tpl.body, vars);
      } else {
        // Mensaje de texto libre de recordatorio
        sentBody = `Hola ${clientName}, te recordamos tu visita programada para ${propertyTitle} el ${dateFormatted}. Estaremos esperándote puntual. Cualquier duda nos puedes escribir por aquí.`;
        await graphRequest(
          `${creds.phoneNumberId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: normalizeRecipient(row.clientPhone),
              type: "text",
              text: { body: sentBody },
            }),
          },
          creds.token,
        );
      }

      // Registrar mensaje saliente en la conversación
      const msgNow = new Date();
      await db.insert(message).values({
        id: newId("message"),
        organizationId: row.organizationId,
        conversationId: conv.id,
        direction: "outbound",
        body: sentBody,
        status: "sent",
        waTimestamp: msgNow,
      });

      await db
        .update(conversation)
        .set({ lastMessageAt: msgNow })
        .where(eq(conversation.id, conv.id));

      sent += 1;
    } catch (err) {
      console.error(
        `[client-reminder] Fallo al enviar WhatsApp para showing ${row.id}:`,
        err instanceof Error ? err.message : String(err),
      );
      skipped += 1;
    }
  }

  return { sent, scanned: due.length, skipped };
}
