"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, SlidersHorizontal, Users, X } from "lucide-react";
import { RequirementsForm } from "@/components/properties/requirements-form";
import { cn } from "@/lib/utils";
import type { MatchingClient } from "@/lib/inbox/types";

function ReasonChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10.5px] font-[500]",
        ok
          ? "text-[color:var(--match-ok-text)] bg-[color:var(--match-ok-bg)] border-[color:var(--match-ok-border)]"
          : "text-[color:var(--match-no-text)] bg-[color:var(--match-no-bg)] border-[color:var(--match-no-border)]",
      )}
    >
      {ok ? <Check size={11} /> : <X size={11} />}
      {label}
    </span>
  );
}

/**
 * Clientes del tenant que hacen match con la propiedad (match inverso, US4). Permite
 * editar los requisitos de cada cliente (US5) para refinar el match in situ.
 */
export function MatchingClientsPanel({ propertyId }: { propertyId: string }) {
  const [clients, setClients] = useState<MatchingClient[] | null>(null);
  const [editing, setEditing] = useState<{ clientId: string; name: string | null } | null>(null);

  const load = useCallback(async () => {
    setClients(null);
    const res = await fetch(`/api/properties/${propertyId}/matching-clients`);
    if (res.ok) {
      setClients(((await res.json()) as { clients: MatchingClient[] }).clients);
    } else {
      setClients([]);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white">
          <Users size={13} />
        </span>
        <h3 className="text-[13px] font-[650] text-text">
          Clientes que hacen match{clients ? ` (${clients.length})` : ""}
        </h3>
      </div>

      {clients === null ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg px-3 py-6 text-[12px] text-text-3">
          <Loader2 size={15} className="animate-spin" /> Calculando…
        </div>
      ) : clients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-bg px-3 py-6 text-center text-[12px] text-text-3">
          Ningún cliente con requisitos compatibles. Captura requisitos de un cliente para verlo aquí.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {clients.map((c) => (
            <div key={c.clientId} className="rounded-lg border border-border bg-bg-panel p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-[600] text-text">{c.name ?? "Sin nombre"}</div>
                  <div className="truncate text-[11.5px] text-text-3">{c.phone}</div>
                </div>
                <span className="text-[15px] font-[700] text-accent">{c.pct}%</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {c.reasons.map((r, i) => (
                  <ReasonChip key={i} ok={r.ok} label={r.label} />
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditing({ clientId: c.clientId, name: c.name })}
                  className="inline-flex items-center gap-1 text-[11px] font-[550] text-text-3 hover:text-text-2"
                >
                  <SlidersHorizontal size={12} /> Editar requisitos
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RequirementsForm
          clientId={editing.clientId}
          clientName={editing.name}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </section>
  );
}
