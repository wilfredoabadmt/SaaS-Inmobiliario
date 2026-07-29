"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Plus, Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DealCard, DealCardOverlay } from "@/components/pipeline/deal-card";
import { DealDrawer } from "@/components/pipeline/deal-drawer";
import { StageConfig } from "@/components/pipeline/stage-config";
import type { AppRole } from "@/lib/auth/guards";
import type { BoardData, DealCard as DealCardType, OrgMember, StageView } from "@/lib/pipeline/types";
import type { ClientListItem } from "@/lib/clients/types";

export interface PropertyOption {
  id: string;
  title: string | null;
  operation: "renta" | "venta";
}

function stageDotStyle(color: string | null): React.CSSProperties {
  return { backgroundColor: color ? `var(${color})` : "var(--text-4)" };
}

/** Columna droppable (US3): resalta cuando una tarjeta está sobre ella; scroll vertical interno. */
function StageColumn({
  stage,
  count,
  children,
}: {
  stage: StageView;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[248px] shrink-0 flex-col rounded-lg bg-bg-sunken",
        isOver && "ring-2 ring-[color:var(--border-strong)]",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="h-2 w-2 rounded-full" style={stageDotStyle(stage.color)} />
        <span className="truncate text-[12.5px] font-[600] text-text-2">{stage.label}</span>
        <span className="ml-auto rounded-full bg-bg-panel px-1.5 py-0.5 text-[10px] font-[650] text-text-3">
          {count}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">{children}</div>
    </div>
  );
}

export function PipelineBoard({
  board,
  clients,
  properties,
  role,
  members,
}: {
  board: BoardData;
  clients: ClientListItem[];
  properties: PropertyOption[];
  role: AppRole;
  members: OrgMember[];
}) {
  const [stages, setStages] = useState<StageView[]>(board.stages);
  const [deals, setDeals] = useState<DealCardType[]>(board.deals);
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const didDragRef = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  async function refresh() {
    try {
      const res = await fetch("/api/pipeline");
      if (res.ok) {
        const data = (await res.json()) as BoardData;
        setStages(data.stages);
        setDeals(data.deals);
      }
    } catch {
      // refresco best-effort; el estado local sigue válido
    }
  }

  async function persistStage(dealId: string, targetId: string, prevId: string) {
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stageId: targetId } : d)));
    try {
      const res = await fetch(`/api/pipeline/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: targetId }),
      });
      if (!res.ok) throw new Error("move failed");
    } catch {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stageId: prevId } : d)));
    }
  }

  function moveByChevron(dealId: string, dir: -1 | 1) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const idx = stages.findIndex((s) => s.id === deal.stageId);
    const next = idx + dir;
    if (next < 0 || next >= stages.length) return;
    const target = stages[next];
    if (!target) return;
    void persistStage(dealId, target.id, deal.stageId);
  }

  function onDragStart(e: DragStartEvent) {
    didDragRef.current = true;
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const dealId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (overId) {
      const deal = deals.find((d) => d.id === dealId);
      if (deal && deal.stageId !== overId && stages.some((s) => s.id === overId)) {
        void persistStage(dealId, overId, deal.stageId);
      }
    }
    // Suprime el clic-apertura que el navegador dispara tras soltar.
    setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }

  function onDragCancel() {
    setActiveId(null);
    setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }

  function openDeal(dealId: string) {
    if (didDragRef.current) return;
    setOpenDealId(dealId);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-end gap-2">
        {role === "owner" ? (
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-panel px-2.5 py-1.5 text-[12.5px] font-[600] text-text-2 shadow-rest hover:bg-bg-hover"
          >
            <Settings2 size={14} /> Configurar etapas
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-panel px-2.5 py-1.5 text-[12.5px] font-[600] text-text-2 shadow-rest hover:bg-bg-hover"
        >
          <Plus size={14} /> Nuevo trato
        </button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {stages.map((stage) => {
            const items = deals.filter((d) => d.stageId === stage.id);
            return (
              <StageColumn key={stage.id} stage={stage} count={items.length}>
                {items.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    stages={stages}
                    onMove={moveByChevron}
                    onOpen={openDeal}
                  />
                ))}
              </StageColumn>
            );
          })}
        </div>
        <DragOverlay>{activeDeal ? <DealCardOverlay deal={activeDeal} /> : null}</DragOverlay>
      </DndContext>

      {creating ? (
        <NewDealModal
          clients={clients}
          properties={properties}
          onClose={() => setCreating(false)}
          onCreated={(deal) => setDeals((prev) => [...prev, deal])}
        />
      ) : null}
      {configOpen ? <StageConfig onClose={() => setConfigOpen(false)} onChanged={refresh} /> : null}
      {openDealId ? (
        <DealDrawer
          dealId={openDealId}
          members={members}
          onClose={() => setOpenDealId(null)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

/** Modal de alta mínima (US1): cliente requerido, propiedad opcional. */
function NewDealModal({
  clients,
  properties,
  onClose,
  onCreated,
}: {
  clients: ClientListItem[];
  properties: PropertyOption[];
  onClose: () => void;
  onCreated: (deal: DealCardType) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!clientId) {
      setError("Elige un cliente");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, propertyId: propertyId || null }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; stageId?: string } | null;
      if (!res.ok || !data?.id || !data.stageId) {
        setError(res.status === 409 ? "Ya existe ese trato" : "No se pudo crear el trato");
        setBusy(false);
        return;
      }
      const cli = clients.find((c) => c.id === clientId);
      const prop = properties.find((p) => p.id === propertyId);
      onCreated({
        id: data.id,
        stageId: data.stageId,
        client: { id: clientId, name: cli?.name ?? null, channel: cli?.channel ?? "manual" },
        property: prop ? { id: prop.id, title: prop.title, operationType: prop.operation } : null,
        assignedAgent: null,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch {
      setError("No se pudo crear el trato");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-bg-panel p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-[650] text-text">Nuevo trato</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-3 hover:bg-bg-hover"
          >
            <X size={15} />
          </button>
        </div>

        <label className="mb-1 block text-[11px] font-[600] text-text-3">Cliente</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mb-3 w-full rounded-md border border-border bg-bg-panel px-2.5 py-1.5 text-[13px] text-text"
        >
          <option value="">Elegir cliente…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ?? c.phone}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-[11px] font-[600] text-text-3">Propiedad (opcional)</label>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="mb-3 w-full rounded-md border border-border bg-bg-panel px-2.5 py-1.5 text-[13px] text-text"
        >
          <option value="">Sin propiedad</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title ?? "Propiedad"}
            </option>
          ))}
        </select>

        {error ? <p className="mb-2 text-[12px] text-[color:var(--prop-cerr-text)]">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[12.5px] font-[600] text-text-3 hover:bg-bg-hover"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className={cn(
              "rounded-md bg-text px-3 py-1.5 text-[12.5px] font-[600] text-bg-panel",
              busy && "opacity-50",
            )}
          >
            {busy ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
