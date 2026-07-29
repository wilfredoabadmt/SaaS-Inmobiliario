import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { candidacy, client, pipelineStage, property } from "@/lib/db/schema/domain";
import { asStageKind, type BoardData, type DealCard, type StageView } from "@/lib/pipeline/types";
import { seedDefaultStages } from "@/server/pipeline/stages";

/**
 * Tablero del pipeline (feature 010, US1): etapas ordenadas de la org + tratos agrupables por
 * etapa. Omite tratos cuyo **cliente o propiedad esté archivado** (soft-delete 007/009). Scoped
 * por `organization_id`. Siembra el embudo por defecto si la org no tenía etapas.
 */
export async function getBoard(organizationId: string): Promise<BoardData> {
  const db = getDb();
  await seedDefaultStages(organizationId);

  const stageRows = await db
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

  const dealRows = await db
    .select({
      id: candidacy.id,
      stageId: candidacy.stageId,
      updatedAt: candidacy.updatedAt,
      clientId: client.id,
      clientName: client.name,
      clientChannel: client.channel,
      propertyId: property.id,
      propertyTitle: property.title,
      propertyOperation: property.operationType,
      agentId: user.id,
      agentName: user.name,
    })
    .from(candidacy)
    .innerJoin(client, eq(candidacy.clientId, client.id))
    .leftJoin(property, eq(candidacy.propertyId, property.id))
    .leftJoin(user, eq(candidacy.assignedAgentId, user.id))
    .where(
      and(
        eq(candidacy.organizationId, organizationId),
        isNull(client.archivedAt),
        // Propiedad ausente (trato sin propiedad) o no archivada.
        or(isNull(candidacy.propertyId), isNull(property.archivedAt)),
      ),
    );

  const stages: StageView[] = stageRows.map((s) => ({
    id: s.id,
    label: s.label,
    sortOrder: s.sortOrder,
    kind: asStageKind(s.kind),
    color: s.color,
  }));

  const deals: DealCard[] = dealRows.map((r) => ({
    id: r.id,
    stageId: r.stageId,
    client: { id: r.clientId, name: r.clientName, channel: r.clientChannel },
    property:
      r.propertyId && r.propertyOperation
        ? { id: r.propertyId, title: r.propertyTitle, operationType: r.propertyOperation }
        : null,
    assignedAgent: r.agentId && r.agentName ? { id: r.agentId, name: r.agentName } : null,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return { stages, deals };
}
