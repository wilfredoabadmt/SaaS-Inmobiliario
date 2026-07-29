import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { client, clientRequirements, property } from "@/lib/db/schema/domain";
import type { ClientRequirements, Match, MatchingClient } from "@/lib/inbox/types";
import { computeMatches, scoreProperty } from "@/server/matching/engine";
import { resolveMainPhotoUrls } from "@/server/properties/photos";
import {
  clientIdForConversation,
  getRequirements,
  type RequirementsRow,
} from "@/server/requirements/service";

const TYPE_LABEL: Record<string, string> = {
  casa: "Casa",
  departamento: "Departamento",
  local: "Local",
  terreno: "Terreno",
};

function budgetLabel(min: string | null, max: string | null): string | undefined {
  const fmt = (s: string) => Number(s).toLocaleString("es-MX", { maximumFractionDigits: 0 });
  if (min && max) return `$${fmt(min)}–$${fmt(max)}`;
  if (max) return `Hasta $${fmt(max)}`;
  if (min) return `Desde $${fmt(min)}`;
  return undefined;
}

/** Convierte la fila de requisitos al view model que consumen los chips del panel. */
export function requirementsToView(row: RequirementsRow): ClientRequirements {
  return {
    operation: row.operation ?? undefined,
    budgetLabel: budgetLabel(row.budgetMin, row.budgetMax),
    zone: row.zone ?? undefined,
    propertyType: row.propertyType ? (TYPE_LABEL[row.propertyType] ?? row.propertyType) : undefined,
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms != null ? Number(row.bathrooms) : undefined,
  };
}

export interface ConversationMatching {
  requirements: ClientRequirements | null;
  matches: Match[];
}

/** Requisitos + ranking real de la conversación (scope de tenant). */
export async function getConversationMatching(
  organizationId: string,
  conversationId: string,
): Promise<ConversationMatching> {
  const clientId = await clientIdForConversation(organizationId, conversationId);
  if (!clientId) return { requirements: null, matches: [] };
  const req = await getRequirements(organizationId, clientId);
  if (!req) return { requirements: null, matches: [] };
  const matches = await computeMatches(organizationId, req, { explain: true });
  // Foto real (URL prefirmada) por match, fuera de la caché de computeMatches para no
  // guardar URLs que expiran: se crean objetos nuevos (no se muta lo cacheado).
  const photoUrls = await resolveMainPhotoUrls(
    organizationId,
    matches.map((m) => m.property.id),
  );
  const withPhotos = matches.map((m) => {
    const url = photoUrls.get(m.property.id);
    return url ? { ...m, property: { ...m.property, photoUrl: url } } : m;
  });
  return { requirements: requirementsToView(req), matches: withPhotos };
}

/**
 * Match **inverso** (feature 007): dada una propiedad, los clientes del tenant cuyos
 * requisitos encajan, ordenados por afinidad con sus razones. Reusa `scoreProperty`
 * (mismo criterio que el directo). Excluye propiedad archivada (→ lista vacía), gate por
 * operación, descarta 0%. Solo del tenant.
 */
export async function matchClientsForProperty(
  organizationId: string,
  propertyId: string,
  opts: { topN?: number } = {},
): Promise<MatchingClient[]> {
  const topN = opts.topN ?? 20;
  const db = getDb();

  const [prop] = await db
    .select()
    .from(property)
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .limit(1);
  // No es del tenant o está archivada → sin candidatos (la propiedad archivada no matchea).
  if (!prop || prop.archivedAt) return [];

  const rows = await db
    .select({ req: clientRequirements, name: client.name, phone: client.phone })
    .from(clientRequirements)
    .innerJoin(client, eq(client.id, clientRequirements.clientId))
    .where(eq(clientRequirements.organizationId, organizationId));

  const out: MatchingClient[] = [];
  for (const r of rows) {
    // Gate por operación: requisito sin operación o coincidente con la de la propiedad.
    if (r.req.operation && r.req.operation !== prop.operationType) continue;
    const { pct, reasons } = scoreProperty(prop, r.req);
    if (pct <= 0) continue;
    out.push({ clientId: r.req.clientId, name: r.name, phone: r.phone, pct, reasons });
  }
  return out.sort((a, b) => b.pct - a.pct).slice(0, topN);
}
