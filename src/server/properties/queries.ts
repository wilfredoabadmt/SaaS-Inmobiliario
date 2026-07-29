import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { property } from "@/lib/db/schema/domain";
import type { OperationType, PropertyView } from "@/lib/inbox/types";
import type { PropertyStatus } from "@/lib/design/status";
import { toPropertyView } from "@/server/matching/engine";
import { resolveMainPhotoUrls } from "@/server/properties/photos";

export interface PropertyListFilters {
  op?: OperationType | "todas";
  status?: PropertyStatus | "todos";
  /** "false" = solo activas (default), "true" = solo archivadas, "all" = ambas. */
  archived?: "false" | "true" | "all";
}

/**
 * Inventario real del tenant para `/properties` (feature 007). Default: solo activas
 * (`archived_at IS NULL`). Integra la foto principal real (URL prefirmada).
 */
export async function listProperties(
  organizationId: string,
  filters: PropertyListFilters = {},
): Promise<PropertyView[]> {
  const conds = [eq(property.organizationId, organizationId)];
  if (filters.op && filters.op !== "todas") conds.push(eq(property.operationType, filters.op));
  if (filters.status && filters.status !== "todos") {
    conds.push(eq(property.status, filters.status));
  }
  const archived = filters.archived ?? "false";
  if (archived === "false") conds.push(isNull(property.archivedAt));
  else if (archived === "true") conds.push(isNotNull(property.archivedAt));
  // "all" → sin condición de archivado.

  const rows = await getDb()
    .select()
    .from(property)
    .where(and(...conds))
    .orderBy(desc(property.createdAt))
    .limit(500);

  const views = rows.map(toPropertyView);
  const photoUrls = await resolveMainPhotoUrls(
    organizationId,
    views.map((v) => v.id),
  );
  return views.map((v) => {
    const url = photoUrls.get(v.id);
    return url ? { ...v, photoUrl: url } : v;
  });
}
