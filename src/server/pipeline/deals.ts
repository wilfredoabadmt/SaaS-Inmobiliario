import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { candidacy, client, pipelineStage, property } from "@/lib/db/schema/domain";
import type { DealCreateInput } from "@/lib/pipeline/schemas";
import { isOrgMember } from "@/server/pipeline/queries";
import { resolveInitialStage } from "@/server/pipeline/stages";

/**
 * Servicio de tratos del pipeline (feature 010, US1). Todo scoped por `organization_id`. El
 * **movimiento manual** (`moveDeal`) admite cualquier dirección (lo decide el usuario); la regla
 * "solo avanzar" es exclusiva de las automatizaciones (`advanceStageForward` en stages.ts).
 */

export type DealWriteResult =
  | { ok: true; id: string; stageId: string }
  | {
      ok: false;
      reason:
        | "client_not_found"
        | "property_not_found"
        | "invalid_stage"
        | "duplicate_deal"
        | "not_a_member"
        | "not_found";
    };

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

/** Alta manual de un trato desde el pipeline (cliente requerido, propiedad/etapa opcionales). */
export async function createDeal(
  organizationId: string,
  input: DealCreateInput,
): Promise<DealWriteResult> {
  const db = getDb();

  const [cli] = await db
    .select({ id: client.id })
    .from(client)
    .where(
      and(
        eq(client.id, input.clientId),
        eq(client.organizationId, organizationId),
        isNull(client.archivedAt),
      ),
    )
    .limit(1);
  if (!cli) return { ok: false, reason: "client_not_found" };

  if (input.propertyId) {
    const [prop] = await db
      .select({ id: property.id })
      .from(property)
      .where(
        and(
          eq(property.id, input.propertyId),
          eq(property.organizationId, organizationId),
          isNull(property.archivedAt),
        ),
      )
      .limit(1);
    if (!prop) return { ok: false, reason: "property_not_found" };
  }

  let stageId: string;
  if (input.stageId) {
    const [st] = await db
      .select({ id: pipelineStage.id })
      .from(pipelineStage)
      .where(and(eq(pipelineStage.id, input.stageId), eq(pipelineStage.organizationId, organizationId)))
      .limit(1);
    if (!st) return { ok: false, reason: "invalid_stage" };
    stageId = st.id;
  } else {
    stageId = await resolveInitialStage(organizationId);
  }

  const id = newId("candidacy");
  try {
    await db.insert(candidacy).values({
      id,
      organizationId,
      clientId: input.clientId,
      propertyId: input.propertyId,
      stageId,
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "duplicate_deal" };
    throw e;
  }
  return { ok: true, id, stageId };
}

/** Mueve un trato a otra etapa (movimiento manual; cualquier dirección). Scoped por org. */
export async function moveDeal(
  organizationId: string,
  dealId: string,
  stageId: string,
): Promise<DealWriteResult> {
  const db = getDb();

  const [st] = await db
    .select({ id: pipelineStage.id })
    .from(pipelineStage)
    .where(and(eq(pipelineStage.id, stageId), eq(pipelineStage.organizationId, organizationId)))
    .limit(1);
  if (!st) return { ok: false, reason: "invalid_stage" };

  const res = await db
    .update(candidacy)
    .set({ stageId, updatedAt: new Date() })
    .where(and(eq(candidacy.id, dealId), eq(candidacy.organizationId, organizationId)))
    .returning({ id: candidacy.id, stageId: candidacy.stageId });
  const row = res[0];
  if (!row) return { ok: false, reason: "not_found" };
  return { ok: true, id: row.id, stageId: row.stageId };
}

/**
 * Asigna/reasigna un trato a un miembro de la org, o lo deja "Sin asignar" (`null`). Valida
 * que el destino sea `member` de la org (US5). Scoped por org.
 */
export async function assignDeal(
  organizationId: string,
  dealId: string,
  assignedAgentId: string | null,
): Promise<DealWriteResult> {
  if (assignedAgentId !== null && !(await isOrgMember(organizationId, assignedAgentId))) {
    return { ok: false, reason: "not_a_member" };
  }
  const res = await getDb()
    .update(candidacy)
    .set({ assignedAgentId, updatedAt: new Date() })
    .where(and(eq(candidacy.id, dealId), eq(candidacy.organizationId, organizationId)))
    .returning({ id: candidacy.id, stageId: candidacy.stageId });
  const row = res[0];
  if (!row) return { ok: false, reason: "not_found" };
  return { ok: true, id: row.id, stageId: row.stageId };
}
