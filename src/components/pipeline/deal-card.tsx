"use client";

import { useDraggable } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OperationBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DealCard as DealCardType, StageView } from "@/lib/pipeline/types";

/** Cabecera compartida (cliente + propiedad) de la tarjeta y su overlay de arrastre. */
function CardHeader({ deal }: { deal: DealCardType }) {
  const clientName = deal.client.name ?? "Cliente de WhatsApp";
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-[600] text-text">{clientName}</span>
        {deal.property ? <OperationBadge operation={deal.property.operationType} /> : null}
      </div>
      <div className="mt-1 truncate text-[12px] text-text-3">
        {deal.property?.title ?? "Sin propiedad"}
      </div>
    </>
  );
}

/** Etiqueta del agente asignado (o "Sin asignar"). */
function AgentLabel({ deal }: { deal: DealCardType }) {
  const agentName = deal.assignedAgent?.name ?? null;
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-text-4">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--fill-avatar-sm)] text-[8px] font-[650] text-text-2">
        {agentName ? agentName.charAt(0) : "·"}
      </span>
      {agentName ?? "Sin asignar"}
    </span>
  );
}

/**
 * Copia visual que renderiza el `DragOverlay` (en un portal a nivel del documento), para que la
 * tarjeta arrastrada NUNCA se recorte por el `overflow` de las columnas y siempre vaya encima.
 */
export function DealCardOverlay({ deal }: { deal: DealCardType }) {
  return (
    <div className="w-[232px] cursor-grabbing rounded-lg border border-border bg-bg-panel p-2.5 shadow-lg">
      <CardHeader deal={deal} />
      <div className="mt-2">
        <AgentLabel deal={deal} />
      </div>
    </div>
  );
}

/**
 * Tarjeta de un trato (feature 010). Arrastrable (US3, @dnd-kit) y abrible con clic (US4 → panel).
 * Durante el arrastre la fuente se atenúa y el movimiento lo dibuja el `DragOverlay` del tablero
 * (no se aplica `transform` aquí, para evitar el recorte por `overflow` de la columna). Los
 * chevrons mueven entre etapas como alternativa accesible.
 */
export function DealCard({
  deal,
  stages,
  onMove,
  onOpen,
}: {
  deal: DealCardType;
  stages: StageView[];
  onMove: (dealId: string, dir: -1 | 1) => void;
  onOpen: (dealId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  const idx = stages.findIndex((s) => s.id === deal.stageId);
  const atStart = idx <= 0;
  const atEnd = idx < 0 || idx >= stages.length - 1;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(deal.id)}
      className={cn(
        "cursor-pointer touch-none rounded-lg border border-border bg-bg-panel p-2.5 shadow-rest",
        isDragging && "opacity-40",
      )}
    >
      <CardHeader deal={deal} />
      <div className="mt-2 flex items-center justify-between">
        <AgentLabel deal={deal} />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={atStart}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMove(deal.id, -1);
            }}
            aria-label="Etapa anterior"
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-3 hover:bg-bg-hover disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            disabled={atEnd}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMove(deal.id, 1);
            }}
            aria-label="Etapa siguiente"
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-3 hover:bg-bg-hover disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
