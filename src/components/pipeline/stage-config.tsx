"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import type { StageConfig } from "@/lib/pipeline/types";

const ANCHOR_LABEL: Record<string, string> = { won: "Ganado", lost: "Perdido", visit: "Visita" };

/**
 * Modo "Configurar etapas" (US2, solo owner): renombrar, agregar, reordenar y eliminar etapas
 * intermedias. Las anclas (won/lost/visit) se marcan como no eliminables. Cada cambio refresca
 * la lista y notifica al tablero.
 */
export function StageConfig({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reassigning, setReassigning] = useState<{ id: string; to: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline/stages");
      const data = res.ok ? ((await res.json()) as { stages: StageConfig[] }) : { stages: [] };
      setStages(data.stages);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function notify() {
    onChanged();
  }

  async function rename(id: string, label: string) {
    const stage = stages.find((s) => s.id === id);
    if (!stage || stage.label === label || !label.trim()) return;
    await fetch(`/api/pipeline/stages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    await load();
    notify();
  }

  async function reorder(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= stages.length) return;
    const ids = stages.map((s) => s.id);
    const tmp = ids[index]!;
    ids[index] = ids[next]!;
    ids[next] = tmp;
    setBusy(true);
    await fetch("/api/pipeline/stages/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    });
    await load();
    notify();
    setBusy(false);
  }

  async function addStage() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pipeline/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Nueva etapa" }),
    });
    if (!res.ok) setError("No se pudo agregar la etapa");
    await load();
    notify();
    setBusy(false);
  }

  async function remove(id: string, reassignToStageId?: string) {
    setBusy(true);
    setError(null);
    const qs = reassignToStageId ? `?reassignToStageId=${reassignToStageId}` : "";
    const res = await fetch(`/api/pipeline/stages/${id}${qs}`, { method: "DELETE" });
    if (res.status === 409) {
      // Tiene tratos → pedir etapa destino.
      const other = stages.find((s) => s.id !== id);
      setReassigning({ id, to: other?.id ?? "" });
      setBusy(false);
      return;
    }
    if (!res.ok) setError("No se pudo eliminar la etapa");
    setReassigning(null);
    await load();
    notify();
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-bg-panel p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-[650] text-text">Configurar etapas</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-3 hover:bg-bg-hover"
          >
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <p className="py-4 text-[13px] text-text-3">Cargando…</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {stages.map((s, i) => (
              <li key={s.id} className="rounded-lg border border-border px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={busy || i === 0}
                      onClick={() => reorder(i, -1)}
                      aria-label="Subir"
                      className="text-text-4 hover:text-text disabled:opacity-30"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={busy || i === stages.length - 1}
                      onClick={() => reorder(i, 1)}
                      aria-label="Bajar"
                      className="text-text-4 hover:text-text disabled:opacity-30"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  <input
                    defaultValue={s.label}
                    onBlur={(e) => rename(s.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-text hover:border-border focus:border-border focus:outline-none"
                  />
                  {s.kind !== "normal" ? (
                    <span className="rounded-full bg-bg-sunken px-1.5 py-0.5 text-[10px] font-[650] text-text-3">
                      {ANCHOR_LABEL[s.kind]}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-text-4">{s.dealCount}</span>
                  <button
                    type="button"
                    disabled={busy || !s.deletable}
                    onClick={() => remove(s.id)}
                    aria-label="Eliminar"
                    title={s.deletable ? "Eliminar etapa" : "Las anclas no se eliminan"}
                    className="text-text-4 hover:text-[color:var(--prop-cerr-text)] disabled:opacity-25"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {reassigning?.id === s.id ? (
                  <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                    <span className="text-[12px] text-text-3">Mover tratos a:</span>
                    <select
                      value={reassigning.to}
                      onChange={(e) => setReassigning({ id: s.id, to: e.target.value })}
                      className="flex-1 rounded-md border border-border bg-bg-panel px-2 py-1 text-[12px] text-text"
                    >
                      {stages
                        .filter((o) => o.id !== s.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(s.id, reassigning.to)}
                      className="rounded-md bg-text px-2 py-1 text-[12px] font-[600] text-bg-panel"
                    >
                      Eliminar
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {error ? <p className="mt-2 text-[12px] text-[color:var(--prop-cerr-text)]">{error}</p> : null}

        <button
          type="button"
          onClick={addStage}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12.5px] font-[600] text-text-2 hover:bg-bg-hover disabled:opacity-50"
        >
          <Plus size={14} /> Agregar etapa
        </button>
      </div>
    </div>
  );
}
