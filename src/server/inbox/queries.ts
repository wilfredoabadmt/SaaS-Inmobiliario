import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  client,
  conversation,
  conversationProperty,
  property,
  template,
} from "@/lib/db/schema/domain";
import { countVariables, type TemplateComponents } from "@/lib/meta/templates";
import type { ConversationListItem, TemplateItem } from "@/lib/inbox/types";

/** Lista de conversaciones de la bandeja (scope de tenant, FR-002). */
export async function listConversations(organizationId: string): Promise<ConversationListItem[]> {
  const rows = await getDb()
    .select({
      id: conversation.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email,
      clientNotes: client.notes,
      aiEnabled: conversation.aiEnabled,
      needsHuman: conversation.needsHuman,
      needsHumanReason: conversation.needsHumanReason,
      lastMessageAt: conversation.lastMessageAt,
      propId: property.id,
      propTitle: property.title,
      propOperation: property.operationType,
    })
    .from(conversation)
    .innerJoin(client, eq(conversation.clientId, client.id))
    .leftJoin(
      conversationProperty,
      and(
        eq(conversationProperty.conversationId, conversation.id),
        eq(conversationProperty.isPrimary, true),
      ),
    )
    .leftJoin(property, eq(conversationProperty.propertyId, property.id))
    .where(eq(conversation.organizationId, organizationId))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    clientPhone: r.clientPhone,
    clientEmail: r.clientEmail,
    notes: r.clientNotes ?? undefined,
    aiEnabled: r.aiEnabled,
    needsHuman: r.needsHuman,
    needsHumanReason: r.needsHumanReason,
    lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
    primaryProperty:
      r.propId && r.propOperation
        ? { id: r.propId, title: r.propTitle, operationType: r.propOperation }
        : null,
  }));
}

/**
 * Plantillas **APPROVED** de la agencia para el selector de la bandeja (feature 012, FR-009).
 * Solo aprobadas son enviables; se expone `variables` para que la bandeja pida sus valores.
 */
export async function listTemplates(organizationId: string): Promise<TemplateItem[]> {
  const rows = await getDb()
    .select({
      id: template.id,
      name: template.name,
      category: template.category,
      body: template.body,
      components: template.components,
    })
    .from(template)
    .where(and(eq(template.organizationId, organizationId), eq(template.status, "APPROVED")));
  return rows.map((t) => {
    const comps = t.components as TemplateComponents | null;
    const variables = comps?.body?.variables ?? countVariables(t.body);
    return { id: t.id, name: t.name, category: t.category, body: t.body, variables };
  });
}
