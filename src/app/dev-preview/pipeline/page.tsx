import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { TYPO } from "@/lib/design/typography";
import { SAMPLE_LEADS } from "@/lib/design/sample-data";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/design/status";
import type { BoardData, StageView } from "@/lib/pipeline/types";

/**
 * Preview visual del pipeline (dev-only). Adapta los fixtures `SAMPLE_LEADS` a la forma real
 * `BoardData` que consume el tablero de la feature 010. No usa BD ni auth.
 */
const STAGE_COLOR: Record<string, string> = {
  nuevo: "--stage-nuevo",
  contactado: "--stage-contactado",
  calificado: "--stage-calificado",
  visita_agendada: "--stage-visita",
  documentacion: "--stage-documentacion",
  en_negociacion: "--stage-negociacion",
  ganado: "--stage-ganado",
};

const previewBoard: BoardData = {
  stages: PIPELINE_STAGES.map(
    (s, i): StageView => ({
      id: s,
      label: STAGE_LABEL[s],
      sortOrder: i,
      kind: s === "ganado" ? "won" : s === "visita_agendada" ? "visit" : "normal",
      color: STAGE_COLOR[s] ?? null,
    }),
  ),
  deals: SAMPLE_LEADS.map((l) => ({
    id: l.id,
    stageId: l.stage,
    client: { id: l.id, name: l.client, channel: "whatsapp" },
    property: { id: l.id, title: l.property, operationType: l.operation },
    assignedAgent: l.agent === "Sin asignar" ? null : { id: l.id, name: l.agent },
    updatedAt: new Date(0).toISOString(),
  })),
};

export default function PipelinePreviewPage() {
  return (
    <div className="flex h-full flex-col px-8 py-8">
      <h1 className={TYPO.h1}>Pipeline de ventas</h1>
      <p className="mt-1 text-[13px] text-text-3">
        Arrastra el avance de cada prospecto entre etapas.
      </p>
      <div className="mt-5 min-h-0 flex-1">
        <PipelineBoard board={previewBoard} clients={[]} properties={[]} role="owner" members={[]} />
      </div>
    </div>
  );
}
