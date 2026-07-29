import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SlaBanner } from "@/components/dashboard/sla-banner";
import { operationDotClass } from "@/lib/design/operation";
import { TYPO } from "@/lib/design/typography";
import { cn } from "@/lib/utils";
import {
  SAMPLE_ACTIVITY,
  SAMPLE_KPIS,
  SAMPLE_UPCOMING_VISITS,
} from "@/lib/design/sample-data";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Cuerpo presentacional del dashboard (reutilizado por la página real y el preview). */
export function DashboardView({ firstName }: { firstName?: string }) {
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-8 py-8">
        {/* Saludo */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className={TYPO.h1}>
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1 text-[13px] capitalize text-text-3">{today} · Mi agencia</p>
          </div>
          <Link
            href="/inbox"
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-[13px] font-[550] text-white transition-colors hover:bg-ink-hover"
          >
            Ir a la bandeja
            <ArrowRight size={15} />
          </Link>
        </div>

        {/* Banner de SLA */}
        <div className="mt-5">
          <SlaBanner count={4} />
        </div>

        {/* KPIs */}
        <div className="mt-5 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          {SAMPLE_KPIS.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>

        {/* Actividad + próximas visitas */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-bg-panel p-4 shadow-rest">
            <h2 className={cn(TYPO.microLabel, "mb-3")}>Actividad reciente del equipo</h2>
            <ul className="space-y-3">
              {SAMPLE_ACTIVITY.map((a, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--fill-avatar-sm)] text-[10px] font-[650] text-text-2">
                    {a.actor.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-text-2">
                    <span className="font-[600] text-text">{a.actor}</span> {a.text}
                    <div className="mt-0.5 text-[11px] text-text-4">{a.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-bg-panel p-4 shadow-rest">
            <h2 className={cn(TYPO.microLabel, "mb-3")}>Próximas visitas</h2>
            <ul className="space-y-2.5">
              {SAMPLE_UPCOMING_VISITS.map((v, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border bg-bg p-2.5"
                >
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-bg-sunken">
                    <span className="text-[9px] font-[650] uppercase text-text-4">{v.month}</span>
                    <span className="text-[15px] font-[700] leading-none text-text">{v.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", operationDotClass(v.operation))} />
                      <span className="truncate text-[13px] font-[600] text-text">{v.client}</span>
                    </div>
                    <div className="truncate text-[12px] text-text-3">{v.property}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-[600] text-text">{v.time}</div>
                    <div className="text-[11px] text-text-4">{v.agent}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
