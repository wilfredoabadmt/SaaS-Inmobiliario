"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, Sparkles, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NeutralChip } from "@/components/ui/badge";
import { PropertyThumb } from "@/components/properties/property-thumb";
import { operationBgClass, operationTextClass } from "@/lib/design/operation";
import { TYPO } from "@/lib/design/typography";
import type { ClientRequirements, Match, PropertyView } from "@/lib/inbox/types";

interface Props {
  conversationId: string;
  clientName: string;
  onSend: (property: PropertyView) => void;
  /** Solo preview dev: inyecta datos sin pegar a la API. */
  preview?: { requirements?: ClientRequirements; matches: Match[] };
}

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

function MatchCard({ match, onSend }: { match: Match; onSend: (p: PropertyView) => void }) {
  const [open, setOpen] = useState(false);
  const { property: p, pct, reasons, why } = match;
  return (
    <div className="rounded-lg border border-border bg-bg-panel p-2.5 shadow-rest transition-shadow hover:shadow-ficha">
      <div className="flex gap-2.5">
        <PropertyThumb
          seed={p.photoSeed}
          photoUrl={p.photoUrl}
          iconSize={20}
          className="h-[74px] w-[74px] shrink-0 rounded-[10px]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-[13px] font-[600] text-text">{p.title}</span>
            <span className={cn(TYPO.matchPct, operationTextClass(p.operation))}>{pct}%</span>
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-text-3">{p.zone}</div>
          <div className="mt-0.5 text-[13px] font-[700] text-text">
            {p.priceLabel} <span className="text-[10px] font-[600] text-text-4">MXN</span>
          </div>
          <div className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-divider">
            <div
              className={cn("h-full rounded-full", operationBgClass(p.operation))}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-text-3">{p.specs}</div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {reasons.map((r, i) => (
          <ReasonChip key={i} ok={r.ok} label={r.label} />
        ))}
      </div>

      {open && why && (
        <p className="mt-2 rounded-md bg-bg px-2 py-1.5 text-[11.5px] leading-relaxed text-text-2">
          {why}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        {why && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-[550] text-text-3 hover:text-text-2"
          >
            <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
            ¿Por qué?
          </button>
        )}
        <button
          type="button"
          onClick={() => onSend(p)}
          className="ml-auto rounded-md bg-ink px-2.5 py-1 text-[11px] font-[550] text-white transition-colors hover:bg-ink-hover"
        >
          Enviar ficha
        </button>
      </div>
    </div>
  );
}

interface MatchingData {
  requirements: ClientRequirements | null;
  matches: Match[];
}

/** Panel de Matching en vivo (US1/004). Carga requisitos + ranking reales del tenant. */
export function MatchingPanel({ conversationId, clientName, onSend, preview }: Props) {
  const [data, setData] = useState<MatchingData | null>(
    preview ? { requirements: preview.requirements ?? null, matches: preview.matches } : null,
  );
  const [loading, setLoading] = useState(!preview);

  useEffect(() => {
    if (preview) return;
    let active = true;
    setLoading(true);
    setData(null);
    fetch(`/api/conversations/${conversationId}/matching`)
      .then((r) => (r.ok ? r.json() : { requirements: null, matches: [] }))
      .then((d: MatchingData) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setData({ requirements: null, matches: [] });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [conversationId, preview]);

  const req = data?.requirements ?? undefined;
  const matches = data?.matches ?? [];

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-accent text-white shadow-rest">
          <Star size={15} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[13px] font-[650] text-text">Matching en vivo</h2>
            <span className="h-1.5 w-1.5 rounded-full bg-status-online animate-pulse-dot" />
          </div>
          <p className="truncate text-[11px] text-text-3">
            {loading
              ? "Calculando…"
              : `${matches.length} ${matches.length === 1 ? "propiedad" : "propiedades"} para ${clientName}`}
          </p>
        </div>
      </div>

      {req && (
        <div className="mb-3 flex flex-wrap gap-1">
          {req.operation && (
            <NeutralChip>{req.operation === "venta" ? "Venta" : "Renta"}</NeutralChip>
          )}
          {req.budgetLabel && <NeutralChip>{req.budgetLabel}</NeutralChip>}
          {req.zone && <NeutralChip>{req.zone}</NeutralChip>}
          {req.propertyType && <NeutralChip>{req.propertyType}</NeutralChip>}
          {req.bedrooms != null && <NeutralChip>{req.bedrooms} rec</NeutralChip>}
          {req.bathrooms != null && <NeutralChip>{req.bathrooms} baños</NeutralChip>}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg px-3 py-6 text-[12px] text-text-3">
          <Loader2 size={15} className="animate-spin" />
          Calculando matches…
        </div>
      ) : !req ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-bg px-3 py-6 text-center">
          <Sparkles size={18} className="text-text-4" />
          <p className="text-[12px] text-text-3">
            Aún no hay requisitos de este cliente. Cuando el agente lo califique (o los captures),
            verás aquí las mejores propiedades.
          </p>
        </div>
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-bg px-3 py-6 text-center">
          <Sparkles size={18} className="text-text-4" />
          <p className="text-[12px] text-text-3">
            No hay propiedades en tu inventario que encajen con lo que busca este cliente.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((m) => (
            <MatchCard key={m.property.id} match={m} onSend={onSend} />
          ))}
        </div>
      )}
    </section>
  );
}
