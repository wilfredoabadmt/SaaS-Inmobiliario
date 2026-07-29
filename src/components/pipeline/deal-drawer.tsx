"use client";

import { useEffect, useState } from "react";
import { ExternalLink, MessageSquare, X } from "lucide-react";
import { AssignAgent } from "@/components/pipeline/assign-agent";
import type { DealDetail, OrgMember } from "@/lib/pipeline/types";

/**
 * Panel lateral de detalle de un trato (US4). Compone cliente + requisitos + propiedad + últimos
 * mensajes (todo ya existente) y deep-linkea a la bandeja. Aloja la asignación de agente (US5).
 */
export function DealDrawer({
  dealId,
  members,
  onClose,
  onChanged,
}: {
  dealId: string;
  members: OrgMember[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pipeline/deals/${dealId}`);
      setDetail(res.ok ? ((await res.json()) as DealDetail) : null);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const clientName = detail?.client.name ?? "Cliente de WhatsApp";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <aside
        className="relative h-full w-full max-w-md overflow-y-auto border-l border-border bg-bg-panel shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-bg-panel px-5 py-3.5">
          <h2 className="text-[15px] font-[650] text-text">{clientName}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-3 hover:bg-bg-hover"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-6 text-[13px] text-text-3">Cargando…</p>
        ) : !detail ? (
          <p className="px-5 py-6 text-[13px] text-text-3">No se pudo cargar el trato.</p>
        ) : (
          <div className="flex flex-col gap-5 px-5 py-4">
            {/* Cliente */}
            <section>
              <div className="flex items-center gap-2 text-[13px] text-text-2">
                <span className="rounded-full bg-bg-sunken px-2 py-0.5 text-[10px] font-[650] uppercase tracking-wide text-text-3">
                  {detail.client.channel}
                </span>
                <span>{detail.client.phone}</span>
              </div>
            </section>

            {/* Asignación (US5) */}
            <section>
              <h3 className="mb-1.5 text-[11px] font-[650] uppercase tracking-wide text-text-4">Agente</h3>
              <AssignAgent
                dealId={detail.id}
                currentAgentId={detail.assignedAgent?.id ?? null}
                members={members}
                onChanged={onChanged}
              />
            </section>

            {/* Requisitos (004) */}
            <section>
              <h3 className="mb-1.5 text-[11px] font-[650] uppercase tracking-wide text-text-4">Requisitos</h3>
              {detail.requirements ? (
                <ul className="space-y-1 text-[13px] text-text-2">
                  {detail.requirements.operation ? <li>Operación: {detail.requirements.operation}</li> : null}
                  {detail.requirements.budgetLabel ? <li>Presupuesto: {detail.requirements.budgetLabel}</li> : null}
                  {detail.requirements.zone ? <li>Zona: {detail.requirements.zone}</li> : null}
                  {detail.requirements.propertyType ? <li>Tipo: {detail.requirements.propertyType}</li> : null}
                  {detail.requirements.bedrooms != null ? <li>Recámaras: {detail.requirements.bedrooms}</li> : null}
                </ul>
              ) : (
                <p className="text-[13px] text-text-4">Sin requisitos registrados.</p>
              )}
            </section>

            {/* Propiedad (007) */}
            <section>
              <h3 className="mb-1.5 text-[11px] font-[650] uppercase tracking-wide text-text-4">Propiedad</h3>
              {detail.property ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  {detail.property.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.property.photoUrl} alt="" className="h-32 w-full object-cover" />
                  ) : (
                    <div className="h-20 w-full bg-bg-sunken" />
                  )}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[13px] font-[600] text-text">{detail.property.title ?? "Propiedad"}</span>
                    <a
                      href="/properties"
                      className="flex items-center gap-1 text-[12px] text-text-3 hover:text-text"
                    >
                      Ver <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-text-4">Sin propiedad (lead temprano).</p>
              )}
            </section>

            {/* Conversación (deep-link a la bandeja) */}
            <section>
              <h3 className="mb-1.5 text-[11px] font-[650] uppercase tracking-wide text-text-4">Conversación</h3>
              {detail.recentMessages.length > 0 ? (
                <ul className="mb-2 space-y-1.5">
                  {detail.recentMessages.map((m) => (
                    <li
                      key={m.id}
                      className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[12.5px] ${
                        m.direction === "inbound"
                          ? "bg-bg-sunken text-text-2"
                          : "ml-auto bg-[color:var(--fill-avatar-sm)] text-text"
                      }`}
                    >
                      {m.body ?? "(sin texto)"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-2 text-[13px] text-text-4">Sin mensajes todavía.</p>
              )}
              <a
                href={`/inbox?c=${detail.conversationId}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-text px-3 py-1.5 text-[12.5px] font-[600] text-bg-panel"
              >
                <MessageSquare size={14} /> Abrir en bandeja
              </a>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
