import { PipelineBoard, type PropertyOption } from "@/components/pipeline/pipeline-board";
import { requireMember } from "@/lib/auth/guards";
import { TYPO } from "@/lib/design/typography";
import { listClients } from "@/server/clients/queries";
import { getBoard } from "@/server/pipeline/board";
import { listOrgMembers } from "@/server/pipeline/queries";
import { listProperties } from "@/server/properties/queries";

export const dynamic = "force-dynamic";

/**
 * Pipeline de ventas real (feature 010). Tablero conectado a `candidacy` con scope de tenant
 * (sustituye los SAMPLE_LEADS de 003): tablero (US1) + configurar etapas si es owner (US2) +
 * drag-and-drop (US3) + panel de detalle (US4) + asignación de agentes (US5). Carga el embudo,
 * clientes/propiedades activos (alta manual) y los miembros (asignación).
 */
export default async function PipelinePage() {
  const { organizationId, role } = await requireMember();
  const [board, clients, propertyViews, members] = await Promise.all([
    getBoard(organizationId),
    listClients(organizationId),
    listProperties(organizationId),
    listOrgMembers(organizationId),
  ]);

  const properties: PropertyOption[] = propertyViews.map((p) => ({
    id: p.id,
    title: p.title ?? null,
    operation: p.operation,
  }));

  return (
    <div className="flex h-full flex-col px-8 py-8">
      <h1 className={TYPO.h1}>Pipeline de ventas</h1>
      <p className="mt-1 text-[13px] text-text-3">
        Arrastra el avance de cada prospecto entre etapas.
      </p>
      <div className="mt-5 min-h-0 flex-1">
        <PipelineBoard
          board={board}
          clients={clients}
          properties={properties}
          role={role}
          members={members}
        />
      </div>
    </div>
  );
}
