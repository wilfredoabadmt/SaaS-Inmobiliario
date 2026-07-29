import { and, asc, count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { candidacy, pipelineStage } from "@/lib/db/schema/domain";
import { asStageKind, type StageConfig, type StageKind } from "@/lib/pipeline/types";
import type { StageCreateInput } from "@/lib/pipeline/schemas";

/**
 * Helpers de etapas del embudo (feature 010). Las etapas son **por organización**
 * (`pipeline_stage`). La semilla por defecto reproduce las 8 etapas actuales de
 * `lib/design/status.ts` para que el comportamiento visible no cambie hasta personalizar.
 */

/** Embudo por defecto (orden = índice). Colores = tokens de `globals.css` (semilla visual). */
const DEFAULT_STAGES: { label: string; kind: StageKind; color: string | null }[] = [
  { label: "Nuevo", kind: "normal", color: "--stage-nuevo" },
  { label: "Contactado", kind: "normal", color: "--stage-contactado" },
  { label: "Calificado", kind: "normal", color: "--stage-calificado" },
  { label: "Visita agendada", kind: "visit", color: "--stage-visita" },
  { label: "Documentación", kind: "normal", color: "--stage-documentacion" },
  { label: "En negociación", kind: "normal", color: "--stage-negociacion" },
  { label: "Ganado", kind: "won", color: "--stage-ganado" },
  { label: "Perdido", kind: "lost", color: null },
];

/**
 * Siembra el embudo por defecto para una organización **si aún no tiene etapas**. Idempotente:
 * vuelve a llamarse sin efecto. La unicidad parcial de anclas (won/lost/visit por org) protege
 * de una doble siembra concurrente (la segunda inserción falla y se ignora).
 */
export async function seedDefaultStages(organizationId: string): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ id: pipelineStage.id })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId))
    .limit(1);
  if (existing.length > 0) return;

  try {
    await db.insert(pipelineStage).values(
      DEFAULT_STAGES.map((s, i) => ({
        id: newId("pipelineStage"),
        organizationId,
        label: s.label,
        sortOrder: i,
        kind: s.kind,
        color: s.color,
      })),
    );
  } catch {
    // Carrera de siembra: otra petición sembró primero (choque en el unique de anclas). OK.
  }
}

/** Id de la etapa inicial (menor `sort_order`). Siembra si la org no tenía etapas. */
export async function resolveInitialStage(organizationId: string): Promise<string> {
  await seedDefaultStages(organizationId);
  const rows = await getDb()
    .select({ id: pipelineStage.id })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId))
    .orderBy(asc(pipelineStage.sortOrder))
    .limit(1);
  const id = rows[0]?.id;
  if (!id) throw new Error("No se pudo resolver la etapa inicial tras la siembra");
  return id;
}

/** Id de la etapa ancla de un `kind` (won/lost/visit) de la org. Siembra si hace falta. */
export async function resolveAnchorStage(
  organizationId: string,
  kind: Extract<StageKind, "won" | "lost" | "visit">,
): Promise<string> {
  await seedDefaultStages(organizationId);
  const rows = await getDb()
    .select({ id: pipelineStage.id })
    .from(pipelineStage)
    .where(and(eq(pipelineStage.organizationId, organizationId), eq(pipelineStage.kind, kind)))
    .limit(1);
  const id = rows[0]?.id;
  if (!id) throw new Error(`No se pudo resolver la etapa ancla '${kind}'`);
  return id;
}

/**
 * Regla de avance (DV-SP-8): mueve un trato a `targetStageId` **solo si** está más adelante en
 * el orden que su etapa actual; si no, no-op. La usan las automatizaciones (visita; IA en 011).
 * El movimiento **manual** del usuario NO pasa por aquí (puede ir en cualquier dirección).
 */
export async function advanceStageForward(
  organizationId: string,
  dealId: string,
  targetStageId: string,
): Promise<void> {
  const db = getDb();
  const [deal] = await db
    .select({ stageId: candidacy.stageId })
    .from(candidacy)
    .where(and(eq(candidacy.id, dealId), eq(candidacy.organizationId, organizationId)))
    .limit(1);
  if (!deal) return;

  const stages = await db
    .select({ id: pipelineStage.id, sortOrder: pipelineStage.sortOrder })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId));
  const current = stages.find((s) => s.id === deal.stageId);
  const target = stages.find((s) => s.id === targetStageId);
  if (!current || !target) return;

  if (target.sortOrder > current.sortOrder) {
    await db
      .update(candidacy)
      .set({ stageId: targetStageId, updatedAt: new Date() })
      .where(and(eq(candidacy.id, dealId), eq(candidacy.organizationId, organizationId)));
  }
}

// ---------- Configuración de etapas (US2, solo owner) ----------

export type StageWriteResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "invalid_after" | "invalid_order" };

export type StageCreateResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid_after" };

export type StageDeleteResult =
  | { ok: true; reassigned: number }
  | { ok: false; reason: "not_found" | "anchor_stage" | "invalid_reassign" }
  | { ok: false; reason: "stage_not_empty"; dealCount: number };

/** Renumera `sort_order` = posición para la lista dada (normaliza tras crear/borrar/reordenar). */
async function renumber(organizationId: string, orderedIds: string[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(pipelineStage)
      .set({ sortOrder: i, updatedAt: new Date() })
      .where(and(eq(pipelineStage.id, orderedIds[i]!), eq(pipelineStage.organizationId, organizationId)));
  }
}

/** Lista las etapas de la org para el modo de configuración (con `deletable` y `dealCount`). */
export async function listStages(organizationId: string): Promise<StageConfig[]> {
  await seedDefaultStages(organizationId);
  const db = getDb();
  const stages = await db
    .select({
      id: pipelineStage.id,
      label: pipelineStage.label,
      sortOrder: pipelineStage.sortOrder,
      kind: pipelineStage.kind,
      color: pipelineStage.color,
    })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId))
    .orderBy(asc(pipelineStage.sortOrder));

  const counts = await db
    .select({ stageId: candidacy.stageId, n: count() })
    .from(candidacy)
    .where(eq(candidacy.organizationId, organizationId))
    .groupBy(candidacy.stageId);
  const countMap = new Map(counts.map((c) => [c.stageId, Number(c.n)]));

  return stages.map((s) => ({
    id: s.id,
    label: s.label,
    sortOrder: s.sortOrder,
    kind: asStageKind(s.kind),
    color: s.color,
    deletable: s.kind === "normal",
    dealCount: countMap.get(s.id) ?? 0,
  }));
}

/** Crea una etapa intermedia (`kind='normal'`) tras `afterStageId` o al final. */
export async function createStage(
  organizationId: string,
  input: StageCreateInput,
): Promise<StageCreateResult> {
  const db = getDb();
  const stages = await db
    .select({ id: pipelineStage.id })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId))
    .orderBy(asc(pipelineStage.sortOrder));
  const ids = stages.map((s) => s.id);

  let insertAt = ids.length;
  if (input.afterStageId) {
    const idx = ids.indexOf(input.afterStageId);
    if (idx < 0) return { ok: false, reason: "invalid_after" };
    insertAt = idx + 1;
  }

  const id = newId("pipelineStage");
  await db.insert(pipelineStage).values({
    id,
    organizationId,
    label: input.label,
    sortOrder: 9999,
    kind: "normal",
    color: null,
  });
  ids.splice(insertAt, 0, id);
  await renumber(organizationId, ids);
  return { ok: true, id };
}

/** Renombra una etapa (permitido también para anclas: cambia solo la etiqueta visible). */
export async function renameStage(
  organizationId: string,
  stageId: string,
  label: string,
): Promise<StageWriteResult> {
  const res = await getDb()
    .update(pipelineStage)
    .set({ label, updatedAt: new Date() })
    .where(and(eq(pipelineStage.id, stageId), eq(pipelineStage.organizationId, organizationId)))
    .returning({ id: pipelineStage.id });
  return res[0] ? { ok: true } : { ok: false, reason: "not_found" };
}

/** Reordena atómicamente: `orderedIds` debe ser EXACTAMENTE el conjunto de etapas de la org. */
export async function reorderStages(
  organizationId: string,
  orderedIds: string[],
): Promise<StageWriteResult> {
  const current = await getDb()
    .select({ id: pipelineStage.id })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId));
  const set = new Set(current.map((s) => s.id));
  if (orderedIds.length !== set.size || !orderedIds.every((id) => set.has(id))) {
    return { ok: false, reason: "invalid_order" };
  }
  await renumber(organizationId, orderedIds);
  return { ok: true };
}

/** Elimina una etapa intermedia. Anclas → rechazo; con tratos → exige `reassignToStageId`. */
export async function deleteStage(
  organizationId: string,
  stageId: string,
  reassignToStageId?: string | null,
): Promise<StageDeleteResult> {
  const db = getDb();
  const [stage] = await db
    .select({ id: pipelineStage.id, kind: pipelineStage.kind })
    .from(pipelineStage)
    .where(and(eq(pipelineStage.id, stageId), eq(pipelineStage.organizationId, organizationId)))
    .limit(1);
  if (!stage) return { ok: false, reason: "not_found" };
  if (stage.kind !== "normal") return { ok: false, reason: "anchor_stage" };

  const deals = await db
    .select({ id: candidacy.id })
    .from(candidacy)
    .where(and(eq(candidacy.organizationId, organizationId), eq(candidacy.stageId, stageId)));

  let reassigned = 0;
  if (deals.length > 0) {
    if (!reassignToStageId) return { ok: false, reason: "stage_not_empty", dealCount: deals.length };
    if (reassignToStageId === stageId) return { ok: false, reason: "invalid_reassign" };
    const [target] = await db
      .select({ id: pipelineStage.id })
      .from(pipelineStage)
      .where(and(eq(pipelineStage.id, reassignToStageId), eq(pipelineStage.organizationId, organizationId)))
      .limit(1);
    if (!target) return { ok: false, reason: "invalid_reassign" };
    await db
      .update(candidacy)
      .set({ stageId: reassignToStageId, updatedAt: new Date() })
      .where(and(eq(candidacy.organizationId, organizationId), eq(candidacy.stageId, stageId)));
    reassigned = deals.length;
  }

  await db
    .delete(pipelineStage)
    .where(and(eq(pipelineStage.id, stageId), eq(pipelineStage.organizationId, organizationId)));

  const remaining = await db
    .select({ id: pipelineStage.id })
    .from(pipelineStage)
    .where(eq(pipelineStage.organizationId, organizationId))
    .orderBy(asc(pipelineStage.sortOrder));
  await renumber(organizationId, remaining.map((s) => s.id));

  return { ok: true, reassigned };
}
