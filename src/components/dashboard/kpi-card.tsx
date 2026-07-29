import { cn } from "@/lib/utils";
import { TYPO } from "@/lib/design/typography";
import type { KpiData } from "@/lib/design/sample-data";

/** Tarjeta de KPI del dashboard. Tono "warn" = bronce (p. ej. sin responder). */
export function KpiCard({ kpi }: { kpi: KpiData }) {
  const warn = kpi.tone === "warn";
  return (
    <div
      className={cn(
        "rounded-lg border p-4 shadow-rest",
        warn
          ? "border-[color:var(--renta-border)] bg-[color:var(--renta-tint)]"
          : "border-border bg-bg-panel",
      )}
    >
      <div className={cn(TYPO.microLabel, warn && "text-[color:var(--renta-text)]")}>
        {kpi.label}
      </div>
      <div className="mt-1.5 flex items-end gap-2">
        <span className={cn(TYPO.kpi, warn && "text-[color:var(--renta-text)]")}>{kpi.value}</span>
        {kpi.delta && (
          <span
            className={cn(
              "mb-1.5 text-[12px] font-[600]",
              warn ? "text-[color:var(--renta-text)]" : "text-status-online",
            )}
          >
            {kpi.delta}
          </span>
        )}
      </div>
    </div>
  );
}
