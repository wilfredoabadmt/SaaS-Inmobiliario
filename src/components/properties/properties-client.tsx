"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, LayoutGrid, Plus, Table2 } from "lucide-react";
import { PropertyCard } from "@/components/properties/property-card";
import { PropertyDetailSheet } from "@/components/properties/property-detail-sheet";
import { PropertyForm } from "@/components/properties/property-form";
import { PropertyTable } from "@/components/properties/property-table";
import { PROPERTY_STATUS_LABEL, type PropertyStatus } from "@/lib/design/status";
import { TYPO } from "@/lib/design/typography";
import { cn } from "@/lib/utils";
import type { OperationType, PropertyView } from "@/lib/inbox/types";

type View = "cards" | "table";
type OpFilter = "todas" | OperationType;
type StatusFilter = "todos" | PropertyStatus;
type ArchivedFilter = "activas" | "archivadas";

const OP_FILTERS: { id: OpFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "venta", label: "Venta" },
  { id: "renta", label: "Renta" },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "disponible", label: "Disponibles" },
  { id: "apartada", label: "Apartadas" },
  { id: "cerrada", label: "Cerradas" },
];

const STATUSES: PropertyStatus[] = ["disponible", "apartada", "cerrada"];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-[12px] font-[550] transition-colors",
        active
          ? "bg-ink text-white"
          : "border border-border-strong bg-bg-panel text-text-3 hover:bg-bg-hover",
      )}
    >
      {children}
    </button>
  );
}

export function PropertiesClient({ properties }: { properties: PropertyView[] }) {
  const router = useRouter();
  const [items, setItems] = useState<PropertyView[]>(properties);
  const [view, setView] = useState<View>("cards");
  const [op, setOp] = useState<OpFilter>("todas");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [archived, setArchived] = useState<ArchivedFilter>("activas");
  // Alta de propiedad (el detalle/edición vive en la hoja de detalle).
  const [creating, setCreating] = useState(false);
  // Propiedad cuyo detalle está abierto (null = ninguno).
  const [detailId, setDetailId] = useState<string | null>(null);

  // Re-sincroniza con el SSR cuando cambia (router.refresh) y estamos en "activas".
  useEffect(() => {
    if (archived === "activas") setItems(properties);
  }, [properties, archived]);

  const filtered = useMemo(
    () =>
      items.filter(
        (p) => (op === "todas" || p.operation === op) && (status === "todos" || p.status === status),
      ),
    [items, op, status],
  );

  /** Recarga la lista desde la API según el filtro de archivado activo. */
  async function reload(which: ArchivedFilter) {
    const res = await fetch(`/api/properties?archived=${which === "archivadas" ? "true" : "false"}`);
    if (res.ok) setItems(((await res.json()) as { properties: PropertyView[] }).properties);
  }

  function switchArchived(which: ArchivedFilter) {
    setArchived(which);
    void reload(which);
  }

  /** Refresca la lista tras un cambio (alta, edición, fotos, estatus…). */
  function refreshList() {
    if (archived === "archivadas") void reload("archivadas");
    else router.refresh();
  }

  /** Acción rápida de estatus (US2). Actualiza el item en memoria sin recargar todo. */
  async function quickStatus(id: string, next: PropertyStatus) {
    const res = await fetch(`/api/properties/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status: next } : p)));
      router.refresh();
    }
  }

  /** Archiva/desarchiva (US2). Al cambiar de conjunto, recarga la lista actual. */
  async function toggleArchive(id: string) {
    const res = await fetch(`/api/properties/${id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: archived === "activas" }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className={TYPO.h1}>Propiedades</h1>
            <span className="rounded-full bg-bg-hover px-2 py-0.5 text-[11px] font-[600] text-text-3">
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle de vista */}
            <div className="flex items-center rounded-md border border-border-strong bg-bg-panel p-0.5">
              <button
                type="button"
                onClick={() => setView("cards")}
                aria-label="Vista de tarjetas"
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded",
                  view === "cards" ? "bg-ink text-white" : "text-text-3 hover:text-text",
                )}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setView("table")}
                aria-label="Vista de tabla"
                className={cn(
                  "flex h-7 w-8 items-center justify-center rounded",
                  view === "table" ? "bg-ink text-white" : "text-text-3 hover:text-text",
                )}
              >
                <Table2 size={15} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-[13px] font-[550] text-white transition-colors hover:bg-ink-hover"
            >
              <Plus size={15} />
              Nueva propiedad
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {OP_FILTERS.map((f) => (
            <Pill key={f.id} active={op === f.id} onClick={() => setOp(f.id)}>
              {f.label}
            </Pill>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          {STATUS_FILTERS.map((f) => (
            <Pill key={f.id} active={status === f.id} onClick={() => setStatus(f.id)}>
              {f.label}
            </Pill>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          <Pill active={archived === "activas"} onClick={() => switchArchived("activas")}>
            Activas
          </Pill>
          <Pill active={archived === "archivadas"} onClick={() => switchArchived("archivadas")}>
            Archivadas
          </Pill>
        </div>

        {/* Contenido */}
        <div className="mt-5">
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-bg-panel px-4 py-10 text-center text-sm text-text-3">
              {archived === "archivadas"
                ? "No hay propiedades archivadas."
                : "No hay propiedades que coincidan con los filtros."}
            </p>
          ) : view === "cards" ? (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(248px,1fr))]">
              {filtered.map((p) => (
                <div key={p.id} className="flex flex-col gap-1.5">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailId(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setDetailId(p.id);
                    }}
                    className="cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <PropertyCard property={p} />
                  </div>
                  {/* Acciones rápidas (US2) */}
                  <div className="flex items-center gap-1.5 px-0.5">
                    <select
                      aria-label="Cambiar estatus"
                      value={p.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => void quickStatus(p.id, e.target.value as PropertyStatus)}
                      className="h-7 flex-1 rounded-sm border border-border bg-bg px-2 text-[11.5px] text-text-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {PROPERTY_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void toggleArchive(p.id)}
                      aria-label={archived === "activas" ? "Archivar" : "Desarchivar"}
                      title={archived === "activas" ? "Archivar" : "Desarchivar"}
                      className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-text-3 hover:bg-bg-hover hover:text-text"
                    >
                      {archived === "activas" ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <PropertyTable properties={filtered} />
          )}
        </div>
      </div>

      {creating && (
        <PropertyForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refreshList();
          }}
        />
      )}

      {detailId && (
        <PropertyDetailSheet
          propertyId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refreshList}
        />
      )}
    </div>
  );
}
