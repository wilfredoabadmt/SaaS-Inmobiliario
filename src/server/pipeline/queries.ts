import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { member, user } from "@/lib/db/schema/auth";
import {
  candidacy,
  client,
  clientRequirements,
  conversation,
  message,
  property,
} from "@/lib/db/schema/domain";
import type { DealDetail, DealRequirements, OrgMember } from "@/lib/pipeline/types";
import { getOrCreateConversation } from "@/server/inbox/conversations";
import { resolveMainPhotoUrls } from "@/server/properties/photos";

/** Etiqueta de presupuesto a partir de min/max (numeric → string). */
function budgetLabel(min: string | null, max: string | null): string | null {
  const fmt = (v: string) => `$${Number(v).toLocaleString("es-MX")}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (max) return `Hasta ${fmt(max)}`;
  if (min) return `Desde ${fmt(min)}`;
  return null;
}

/**
 * Detalle de un trato para el panel lateral (feature 010, US4). Compone datos ya existentes
 * (cliente 009, requisitos 004, propiedad+foto 007, conversación + últimos mensajes). Garantiza
 * un `conversationId` con `getOrCreateConversation` (009) para el deep-link a la bandeja. Scoped
 * por org: trato de otra org → null (el endpoint responde 404).
 */
export async function getDealDetail(
  organizationId: string,
  dealId: string,
): Promise<DealDetail | null> {
  const db = getDb();

  const [deal] = await db
    .select({
      id: candidacy.id,
      clientId: candidacy.clientId,
      propertyId: candidacy.propertyId,
      stageId: candidacy.stageId,
      assignedAgentId: candidacy.assignedAgentId,
    })
    .from(candidacy)
    .where(and(eq(candidacy.id, dealId), eq(candidacy.organizationId, organizationId)))
    .limit(1);
  if (!deal) return null;

  const [cli] = await db
    .select({ id: client.id, name: client.name, phone: client.phone, channel: client.channel })
    .from(client)
    .where(and(eq(client.id, deal.clientId), eq(client.organizationId, organizationId)))
    .limit(1);
  if (!cli) return null;

  // Requisitos (004), opcionales.
  const [req] = await db
    .select({
      operation: clientRequirements.operation,
      budgetMin: clientRequirements.budgetMin,
      budgetMax: clientRequirements.budgetMax,
      zone: clientRequirements.zone,
      propertyType: clientRequirements.propertyType,
      bedrooms: clientRequirements.bedrooms,
      bathrooms: clientRequirements.bathrooms,
    })
    .from(clientRequirements)
    .where(
      and(
        eq(clientRequirements.clientId, deal.clientId),
        eq(clientRequirements.organizationId, organizationId),
      ),
    )
    .limit(1);
  const requirements: DealRequirements | null = req
    ? {
        operation: req.operation,
        budgetLabel: budgetLabel(req.budgetMin, req.budgetMax),
        zone: req.zone,
        propertyType: req.propertyType,
        bedrooms: req.bedrooms,
        bathrooms: req.bathrooms,
      }
    : null;

  // Propiedad del trato (007) + foto principal prefirmada, opcional.
  let propertyView: DealDetail["property"] = null;
  if (deal.propertyId) {
    const [prop] = await db
      .select({ id: property.id, title: property.title, operationType: property.operationType })
      .from(property)
      .where(and(eq(property.id, deal.propertyId), eq(property.organizationId, organizationId)))
      .limit(1);
    if (prop) {
      const photos = await resolveMainPhotoUrls(organizationId, [prop.id]);
      propertyView = {
        id: prop.id,
        title: prop.title,
        operationType: prop.operationType,
        photoUrl: photos.get(prop.id) ?? null,
      };
    }
  }

  // Conversación (get-or-create) + últimos ~5 mensajes (cronológico).
  const conv = await getOrCreateConversation(organizationId, deal.clientId, cli.phone);
  const recent = await db
    .select({ id: message.id, direction: message.direction, body: message.body, createdAt: message.createdAt })
    .from(message)
    .where(and(eq(message.organizationId, organizationId), eq(message.conversationId, conv.id)))
    .orderBy(desc(message.createdAt))
    .limit(5);
  const recentMessages = recent
    .reverse()
    .map((m) => ({ id: m.id, direction: m.direction, body: m.body, createdAt: m.createdAt.toISOString() }));

  // Agente asignado (US5).
  let assignedAgent: DealDetail["assignedAgent"] = null;
  if (deal.assignedAgentId) {
    const [u] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, deal.assignedAgentId))
      .limit(1);
    if (u) assignedAgent = { id: u.id, name: u.name };
  }

  return {
    id: deal.id,
    stageId: deal.stageId,
    client: { id: cli.id, name: cli.name, phone: cli.phone, channel: cli.channel },
    requirements,
    property: propertyView,
    conversationId: conv.id,
    recentMessages,
    assignedAgent,
  };
}

/** Miembros de la organización activa (US5), para el selector de asignación. */
export async function listOrgMembers(organizationId: string): Promise<OrgMember[]> {
  const rows = await getDb()
    .select({ userId: member.userId, role: member.role, name: user.name })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId));
  return rows.map((r) => ({
    id: r.userId,
    name: r.name,
    role: r.role === "owner" ? "owner" : "agent",
  }));
}

/** ¿El usuario es miembro de la organización? (validación de asignación, US5). */
export async function isOrgMember(organizationId: string, userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);
  return Boolean(row);
}
