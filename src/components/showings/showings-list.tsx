import { MessageCircle } from "lucide-react";
import { VisitStatusBadge } from "@/components/ui/badge";
import { operationDotClass } from "@/lib/design/operation";
import { TYPO } from "@/lib/design/typography";
import { cn } from "@/lib/utils";
import type { VisitRow } from "@/lib/design/sample-data";

/** Lista presentacional de visitas (reutilizada por la página real y el preview). */
export function ShowingsList({ visits, embedded = false }: { visits: VisitRow[]; embedded?: boolean }) {
  const inner = (
    <>
      {!embedded && <h1 className={TYPO.h1}>Visitas</h1>}

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/20 bg-accent-tint px-3 py-2 text-[12.5px] text-accent-text">
        <MessageCircle size={15} />
        Se envía un recordatorio automático por WhatsApp (plantilla aprobada) al cliente antes
        de cada visita.
      </div>

      {visits.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-border bg-bg-panel px-4 py-10 text-center text-sm text-text-3">
            No hay visitas agendadas todavía.
          </p>
        ) : (
          <ul className="mt-5 space-y-2.5">
            {visits.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-3.5 rounded-lg border border-border bg-bg-panel p-3 shadow-rest"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-bg-sunken">
                  <span className="text-[9px] font-[650] uppercase text-text-4">{v.month}</span>
                  <span className="text-[16px] font-[700] leading-none text-text">{v.day}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", operationDotClass(v.operation))} />
                    <span className="truncate text-[13.5px] font-[600] text-text">{v.client}</span>
                  </div>
                  <div className="truncate text-[12.5px] text-text-3">{v.property}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-[600] text-text">{v.time}</div>
                  <div className="text-[11px] text-text-4">{v.agent}</div>
                </div>
                <VisitStatusBadge status={v.status} className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
    </>
  );

  if (embedded) {
    return <div className="mx-auto max-w-[880px] px-8 pb-8">{inner}</div>;
  }
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-8 py-8">{inner}</div>
    </div>
  );
}
