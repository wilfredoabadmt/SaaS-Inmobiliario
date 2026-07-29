"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Totals {
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  cost: number | null;
  currency: string | null;
  costAvailable: boolean;
}
interface AnalyticsResult {
  range: { start: string; end: string };
  totals: Totals;
}

const METRICS: Array<{ key: keyof Totals; label: string }> = [
  { key: "sent", label: "Enviados" },
  { key: "delivered", label: "Entregados" },
  { key: "read", label: "Leídos" },
  { key: "clicked", label: "Clics" },
];

/** Panel de estadísticas de una plantilla (feature 012, FR-011). Degrada a "sin datos". */
export function TemplateStats({ templateId }: { templateId: string }) {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/templates/${templateId}/analytics`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.error) setError(d.error.message ?? "No se pudieron cargar las estadísticas");
        else setData(d as AnalyticsResult);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("No se pudieron cargar las estadísticas");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [templateId]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[12px] text-text-3">
        <Loader2 size={13} className="animate-spin" /> Cargando estadísticas…
      </div>
    );
  }
  if (error) return <p className="mt-3 text-[12px] text-text-4">{error}</p>;
  if (!data) return null;

  const t = data.totals;
  const empty = t.sent === 0 && t.delivered === 0 && t.read === 0 && t.clicked === 0;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-[11px] text-text-4">
        Últimos 30 días ({data.range.start} → {data.range.end})
      </p>
      {empty ? (
        <p className="text-[12px] text-text-3">Sin datos todavía.</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {METRICS.map((m) => (
            <div key={m.key}>
              <p className="text-[16px] font-[650] text-text">{t[m.key] as number}</p>
              <p className="text-[11px] text-text-4">{m.label}</p>
            </div>
          ))}
          <div>
            <p className="text-[16px] font-[650] text-text">
              {t.costAvailable && t.cost != null
                ? `${t.cost.toFixed(2)} ${t.currency ?? ""}`.trim()
                : "—"}
            </p>
            <p className="text-[11px] text-text-4">{t.costAvailable ? "Costo" : "Costo no disponible"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
