"use client";

import { useMemo, useState } from "react";
import { Bot, Search, UserRound } from "lucide-react";
import { ChatThread } from "@/components/inbox/chat-thread";
import { MatchingPanel } from "@/components/inbox/matching-panel";
import { OperationBadge } from "@/components/ui/badge";
import { operationAvatarClasses } from "@/lib/design/operation";
import { TYPO } from "@/lib/design/typography";
import { needsHumanShort } from "@/lib/inbox/agent-signal";
import type {
  ConversationListItem,
  MessageItem,
  PropertyView,
  TemplateItem,
} from "@/lib/inbox/types";
import { cn } from "@/lib/utils";

/** Asesor "yo" para el filtro "Asignadas a mí" (en producción = usuario activo). */
const ME = "Carlos R.";

type Filter = "todas" | "sin_leer" | "mias" | "sin_asignar";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "sin_leer", label: "Sin leer" },
  { id: "mias", label: "Asignadas a mí" },
  { id: "sin_asignar", label: "Sin asignar" },
];

function initials(name: string | null, phone: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (a + b).toUpperCase();
  }
  return phone.replace(/\D/g, "").slice(-2);
}

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

interface Props {
  conversations: ConversationListItem[];
  templates: TemplateItem[];
  /** Deep-link "Enviar mensaje" desde Contactos (feature 009): conversación a preseleccionar. */
  initialConversationId?: string | null;
  /** Solo preview dev: mensajes mock por conversación. */
  previewMessagesByConv?: Record<string, MessageItem[]>;
}

/** Bandeja de 3 columnas (lista · hilo · matching+contexto), estilo papel. */
export function InboxClient({
  conversations,
  templates,
  initialConversationId,
  previewMessagesByConv,
}: Props) {
  // Preselección: el deep-link `?c=` gana si pertenece a esta org (está en la lista
  // scoped); si no existe/es ajeno, se ignora y cae a la primera (sin filtrar datos).
  const [selectedId, setSelectedId] = useState<string | null>(
    (initialConversationId && conversations.some((c) => c.id === initialConversationId)
      ? initialConversationId
      : conversations[0]?.id) ?? null,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  /** Aviso transitorio del envío de ficha (éxito/error). */
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "sin_leer" && !(c.unread && c.unread > 0)) return false;
      if (filter === "mias" && c.assignee !== ME) return false;
      if (filter === "sin_asignar" && c.assignee !== "Sin asignar") return false;
      if (!q) return true;
      return (
        (c.clientName ?? "").toLowerCase().includes(q) ||
        c.clientPhone.toLowerCase().includes(q) ||
        (c.primaryProperty?.title ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, query, filter]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  /** Envía la ficha como tarjeta real por WhatsApp (feature 006). El poll de tiempo
   *  real mostrará el mensaje en el hilo. */
  async function handleSendFicha(property: PropertyView) {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}/ficha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id }),
      });
      if (res.ok) {
        setNotice({ kind: "ok", text: "Ficha enviada ✓" });
      } else {
        const d = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setNotice({ kind: "err", text: d?.error?.message ?? "No se pudo enviar la ficha." });
      }
    } catch {
      setNotice({ kind: "err", text: "Error de red al enviar la ficha." });
    }
    setTimeout(() => setNotice(null), 4000);
  }

  return (
    <div className="grid h-full grid-cols-[330px_1fr_374px]">
      {/* Columna 1 — lista de conversaciones */}
      <div className="flex min-h-0 flex-col border-r border-border bg-bg-panel">
        <div className="flex items-center justify-between px-4 pb-1.5 pt-4">
          <h1 className={TYPO.section}>Bandeja</h1>
          <span className="rounded-full bg-bg-hover px-2 py-0.5 text-[11px] font-[600] text-text-3">
            {conversations.length} chats
          </span>
        </div>

        {/* Estado de WhatsApp */}
        <div className="flex items-center gap-1.5 px-4 pb-2 text-[11px] text-text-3">
          <span className="h-1.5 w-1.5 rounded-full bg-status-online animate-pulse-dot" />
          WhatsApp conectado · +52 55 4040 1212
        </div>

        {/* Búsqueda */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-border-strong bg-bg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-accent-tint">
            <Search size={15} className="text-text-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono o propiedad…"
              className="w-full bg-transparent text-sm text-text placeholder:text-text-4 focus:outline-none"
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-[550] transition-colors",
                  active
                    ? "bg-ink text-white"
                    : "border border-border-strong bg-bg text-text-3 hover:bg-bg-hover",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-3">
              {conversations.length === 0 ? "No hay conversaciones todavía." : "Sin resultados."}
            </p>
          )}
          {filtered.map((c) => {
            const active = selectedId === c.id;
            const op = c.primaryProperty?.operationType;
            const unread = c.unread && c.unread > 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-l-[3px] px-4 py-2.5 text-left transition-colors",
                  active
                    ? cn("bg-bg-sunken", op === "venta" ? "border-venta" : op === "renta" ? "border-renta" : "border-accent")
                    : "border-transparent hover:bg-bg-hover",
                )}
              >
                <span className="relative">
                  <span
                    className={cn(
                      "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-xs font-[650]",
                      op ? operationAvatarClasses(op) : "bg-bg-hover text-text-3",
                    )}
                  >
                    {initials(c.clientName, c.clientPhone)}
                  </span>
                  {unread ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-bg-panel bg-status-online px-1 text-[10px] font-[650] text-white">
                      {c.unread}
                    </span>
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm text-text",
                        unread ? "font-[700]" : "font-[600]",
                      )}
                    >
                      {c.clientName ?? c.clientPhone}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px]",
                        unread ? "font-[650] text-status-online" : "text-text-4",
                      )}
                    >
                      {timeLabel(c.lastMessageAt)}
                    </span>
                  </div>
                  {c.lastMessagePreview && (
                    <div className="mt-0.5 truncate text-[12px] text-text-3">
                      {c.lastMessagePreview}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1.5">
                    {op && <OperationBadge operation={op} />}
                    {c.needsHuman ? (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-[color:var(--match-no-bg)] px-1.5 py-0.5 text-[9px] font-[650] text-[color:var(--match-no-text)]"
                        title={`Requiere atención humana: ${needsHumanShort(c.needsHumanReason)}`}
                      >
                        <UserRound size={9} />
                        {needsHumanShort(c.needsHumanReason)}
                      </span>
                    ) : c.aiEnabled ? (
                      <span
                        className="inline-flex items-center rounded-full bg-accent-tint px-1 py-0.5 text-accent-text"
                        title="Agente IA activo"
                      >
                        <Bot size={10} />
                      </span>
                    ) : null}
                    <span className="truncate text-[11px] text-text-4">
                      {c.primaryProperty?.title ?? c.clientPhone}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Columna 2 — hilo de chat */}
      <div className="min-h-0 min-w-0">
        {selected ? (
          <ChatThread
            key={selected.id}
            conversation={selected}
            templates={templates}
            previewMessages={previewMessagesByConv?.[selected.id]}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-text-3">
            <Search size={22} className="text-text-4" />
            <p className="text-sm">Selecciona una conversación</p>
          </div>
        )}
      </div>

      {/* Columna 3 — matching + contexto */}
      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-border bg-bg-panel p-4">
        {selected ? (
          <>
            <MatchingPanel
              conversationId={selected.id}
              clientName={selected.clientName ?? "este cliente"}
              onSend={handleSendFicha}
              preview={
                previewMessagesByConv
                  ? { requirements: selected.requirements, matches: selected.matches ?? [] }
                  : undefined
              }
            />

            <section>
              <h2 className={cn(TYPO.microLabel, "mb-2")}>Datos del cliente</h2>
              <div className="space-y-1.5 rounded-lg border border-border bg-bg p-3 text-[12.5px]">
                <div className="flex justify-between gap-2">
                  <span className="text-text-4">Teléfono</span>
                  <span className="text-text-2">{selected.clientPhone}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text-4">Correo</span>
                  <span className="truncate text-text-2">{selected.clientEmail ?? "—"}</span>
                </div>
                {selected.assignee && (
                  <div className="flex justify-between gap-2">
                    <span className="text-text-4">Asesor</span>
                    <span className="text-text-2">{selected.assignee}</span>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className={cn(TYPO.microLabel, "mb-2")}>Notas internas</h2>
              <div className="rounded-lg border border-border bg-bg p-3 text-[12.5px] text-text-2">
                {selected.notes?.trim() ? (
                  selected.notes
                ) : (
                  <span className="text-text-4">Sin notas todavía.</span>
                )}
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-text-3">Sin conversación seleccionada.</p>
        )}
      </aside>

      {notice && (
        <div
          className={cn(
            "fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[12.5px] font-[600] shadow-ficha",
            notice.kind === "ok"
              ? "bg-ink text-white"
              : "border border-[color:var(--match-no-border)] bg-[color:var(--match-no-bg)] text-[color:var(--match-no-text)]",
          )}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
