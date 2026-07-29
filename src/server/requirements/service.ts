import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { clientRequirements, conversation } from "@/lib/db/schema/domain";
import type { OperationType } from "@/lib/inbox/types";

/** Fila de requisitos (tal como vive en la BD). */
export type RequirementsRow = typeof clientRequirements.$inferSelect;

/** Campos que el agente/asesor puede aportar. `undefined`/`null` = no tocar (merge, D8). */
export interface RequirementsPatch {
  operation?: OperationType | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  zone?: string | null;
  propertyType?: "casa" | "departamento" | "local" | "terreno" | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  notes?: string | null;
}

export async function getRequirements(
  organizationId: string,
  clientId: string,
): Promise<RequirementsRow | null> {
  const rows = await getDb()
    .select()
    .from(clientRequirements)
    .where(
      and(
        eq(clientRequirements.organizationId, organizationId),
        eq(clientRequirements.clientId, clientId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Resuelve el clientId de una conversación (con scope de tenant). */
export async function clientIdForConversation(
  organizationId: string,
  conversationId: string,
): Promise<string | null> {
  const rows = await getDb()
    .select({ clientId: conversation.clientId })
    .from(conversation)
    .where(
      and(eq(conversation.id, conversationId), eq(conversation.organizationId, organizationId)),
    )
    .limit(1);
  return rows[0]?.clientId ?? null;
}

const numStr = (n: number | null | undefined): string | null =>
  n === null || n === undefined ? null : String(n);

/**
 * Upsert con **merge**: solo aplica los campos del patch que vienen con valor
 * concreto (no null/undefined), conservando lo previo. Sube `version` solo si algo
 * cambió (invalida la caché de matches). Devuelve la fila resultante.
 */
export async function upsertRequirements(
  organizationId: string,
  clientId: string,
  patch: RequirementsPatch,
  source: "ai" | "manual",
): Promise<RequirementsRow> {
  const db = getDb();
  const existing = await getRequirements(organizationId, clientId);

  // Construye el conjunto de cambios efectivos (solo valores concretos).
  const next: Record<string, unknown> = {};
  if (patch.operation != null) next.operation = patch.operation;
  if (patch.budgetMin != null) next.budgetMin = numStr(patch.budgetMin);
  if (patch.budgetMax != null) next.budgetMax = numStr(patch.budgetMax);
  if (patch.zone != null && patch.zone.trim()) next.zone = patch.zone.trim();
  if (patch.propertyType != null) next.propertyType = patch.propertyType;
  if (patch.bedrooms != null) next.bedrooms = patch.bedrooms;
  if (patch.bathrooms != null) next.bathrooms = numStr(patch.bathrooms);
  if (patch.notes != null && patch.notes.trim()) next.notes = patch.notes.trim();

  if (!existing) {
    const id = newId("clientRequirements");
    const inserted = await db
      .insert(clientRequirements)
      .values({ id, organizationId, clientId, source, version: 1, ...next })
      .returning();
    return inserted[0]!;
  }

  // ¿Cambió algo respecto a lo existente?
  const changed = Object.entries(next).some(
    ([k, v]) => (existing as Record<string, unknown>)[k] !== v,
  );
  if (!changed) return existing;

  const updated = await db
    .update(clientRequirements)
    .set({ ...next, source, version: existing.version + 1, updatedAt: new Date() })
    .where(eq(clientRequirements.id, existing.id))
    .returning();
  return updated[0]!;
}
