"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bot, Check, CheckCheck, Clock, Paperclip, Send, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { OperationBadge, StageBadge } from "@/components/ui/badge";
import { PropertyThumb } from "@/components/properties/property-thumb";
import { operationAvatarClasses } from "@/lib/design/operation";
import type {
  MessageItem,
  ConversationListItem,
  NeedsHumanReason,
  TemplateItem,
} from "@/lib/inbox/types";
import { needsHumanLabel, nonTextLabel } from "@/lib/inbox/agent-signal";
import { renderBody } from "@/lib/meta/templates";
import { useRealtimeMessages } from "@/lib/realtime/useRealtimeMessages";

async function fetchMessages(conversationId: string): Promise<MessageItem[]> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error("No se pudieron cargar los mensajes");
  const data = (await res.json()) as { messages: MessageItem[] };
  return data.messages;
}

/** Tick de estado de un mensaje saliente (sent/delivered/read/failed). */
function StatusTicks({ status }: { status: string | null }) {
  if (status === "failed")
    return <AlertCircle size={13} className="text-[color:var(--match-no-text)]" aria-label="Falló" />;
  if (status === "read")
    return <CheckCheck size={14} className="text-[color:var(--receipt-read)]" aria-label="Leído" />;
  if (status === "delivered")
    return <CheckCheck size={14} className="text-[color:var(--receipt-sent)]" aria-label="Entregado" />;
  return <Check size={14} className="text-[color:var(--receipt-sent)]" aria-label="Enviado" />;
}

function dateChip(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long" });
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string | null, phone: string): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
  }
  return phone.replace(/\D/g, "").slice(-2);
}

interface Props {
  conversation: ConversationListItem;
  templates: TemplateItem[];
  /** Solo preview dev: inyecta mensajes sin pegar a la API/DB. */
  previewMessages?: MessageItem[];
  /** Fichas/mensajes añadidos localmente (p. ej. "Enviar ficha" del matching). */
  injectedMessages?: MessageItem[];
}

/** Hilo de chat. Consume la abstracción de tiempo real (DV-1): no sabe si por dentro
 *  es polling o websocket. El rediseño 003 cambia presentación, no contratos. */
export function ChatThread({ conversation, templates, previewMessages, injectedMessages }: Props) {
  const conversationId = conversation.id;
  const { data: fetched, isLoading } = useRealtimeMessages<MessageItem[]>(
    () => (previewMessages ? Promise.resolve(previewMessages) : fetchMessages(conversationId)),
    { intervalMs: previewMessages ? 1_000_000 : 4000 },
  );
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [tplVars, setTplVars] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(Boolean(conversation.aiEnabled));
  const [needsHuman, setNeedsHuman] = useState(Boolean(conversation.needsHuman));
  const [needsHumanReason, setNeedsHumanReason] = useState<NeedsHumanReason | null>(
    conversation.needsHumanReason ?? null,
  );
  const [agentBusy, setAgentBusy] = useState(false);

  async function postAgent(body: unknown) {
    setAgentBusy(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const d = (await res.json()) as {
          aiEnabled: boolean;
          needsHuman: boolean;
          needsHumanReason: NeedsHumanReason | null;
        };
        setAiEnabled(d.aiEnabled);
        setNeedsHuman(d.needsHuman);
        setNeedsHumanReason(d.needsHumanReason ?? null);
      }
    } finally {
      setAgentBusy(false);
    }
  }

  const messages = useMemo(
    () => [...(fetched ?? []), ...(injectedMessages ?? [])],
    [fetched, injectedMessages],
  );

  // Auto-scroll al último mensaje cuando cambian los mensajes (apertura + nuevos).
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /** Ventana de servicio 24h: abierta si el último entrante fue hace < 24h. */
  const windowOpen = useMemo(() => {
    const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
    if (!lastInbound) return false;
    return Date.now() - new Date(lastInbound.createdAt).getTime() < 24 * 3_600_000;
  }, [messages]);

  async function send(url: string, body: unknown): Promise<boolean> {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(
          data?.error?.message ??
            "No se pudo enviar. Revisa la conexión de WhatsApp: el token de Meta pudo haber vencido.",
        );
        return false;
      }
      return true;
    } catch {
      setError("Error de red al enviar. Inténtalo de nuevo.");
      return false;
    } finally {
      setSending(false);
    }
  }

  function sendText() {
    const value = text.trim();
    if (!value || sending) return;
    void send(`/api/conversations/${conversationId}/messages`, { body: value }).then((ok) => {
      if (ok) setText("");
    });
  }

  const op = conversation.primaryProperty?.operationType;
  const name = conversation.clientName ?? conversation.clientPhone;
  let lastDay = "";

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--chat-bg)" }}>
      {/* Cabecera de la conversación */}
      <header className="flex items-center gap-3 border-b border-border bg-bg-panel px-4 py-2.5">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-xs font-[650]",
            op ? operationAvatarClasses(op) : "bg-bg-hover text-text-2",
          )}
        >
          {initials(conversation.clientName, conversation.clientPhone)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-[600] text-text">{name}</span>
            {op && <OperationBadge operation={op} />}
          </div>
          <div className="text-xs text-text-3">{conversation.clientPhone}</div>
        </div>
        <div className="flex items-center gap-2">
          {needsHuman ? (
            <button
              type="button"
              disabled={agentBusy}
              onClick={() => void postAgent({ resume: true })}
              title="Esta conversación requiere atención humana. Reactiva el agente cuando quieras."
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--match-no-border)] bg-[color:var(--match-no-bg)] px-2 py-1 text-[11px] font-[600] text-[color:var(--match-no-text)] hover:opacity-90 disabled:opacity-50"
            >
              <UserRound size={12} />
              {needsHumanLabel(needsHumanReason)} · Reanudar
            </button>
          ) : (
            <button
              type="button"
              disabled={agentBusy}
              onClick={() => void postAgent({ enabled: !aiEnabled })}
              title="Activa el agente de IA para que responda a este cliente automáticamente."
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-[600] transition-colors disabled:opacity-50",
                aiEnabled
                  ? "border-accent/30 bg-accent-tint text-accent-text"
                  : "border-border-strong bg-bg text-text-3 hover:bg-bg-hover",
              )}
            >
              <Bot size={13} />
              Agente IA {aiEnabled ? "activo" : "off"}
            </button>
          )}
          {conversation.stage && <StageBadge stage={conversation.stage} />}
        </div>
      </header>

      {/* Franja de ventana de 24h */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-[550]",
          windowOpen
            ? "bg-[color:var(--win-open-bg)] text-[color:var(--win-open-text)]"
            : "bg-[color:var(--win-closed-bg)] text-[color:var(--win-closed-text)]",
        )}
      >
        <Clock size={12} />
        {windowOpen
          ? "Ventana de 24 h abierta — puedes escribir libremente."
          : "Fuera de la ventana de 24 h — requiere plantilla aprobada."}
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {isLoading && !previewMessages && (
          <p className="text-center text-sm text-text-3">Cargando…</p>
        )}
        {messages.length === 0 && !isLoading && (
          <p className="py-8 text-center text-sm text-text-3">Sin mensajes todavía.</p>
        )}
        {messages.map((m) => {
          const day = dateChip(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const out = m.direction === "outbound";

          return (
            <Fragment key={m.id}>
              {showDay && (
                <div className="flex justify-center py-2">
                  <span className="rounded-full bg-divider px-2.5 py-0.5 text-[11px] font-[550] text-text-3">
                    {day}
                  </span>
                </div>
              )}

              {m.kind === "property" && m.property ? (
                <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                  <div className="w-[265px] overflow-hidden rounded-2xl border border-[color:var(--bubble-out-border)] bg-bg-panel shadow-ficha">
                    <PropertyThumb
                      seed={m.property.photoSeed}
                      photoUrl={m.property.photoUrl}
                      className="h-28 w-full"
                    />
                    <div className="p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-[600] text-text">
                          {m.property.title}
                        </span>
                        <OperationBadge operation={m.property.operation} />
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-text-3">{m.property.zone}</div>
                      <div className="mt-1 text-[15px] font-[700] text-text">
                        {m.property.priceLabel}{" "}
                        <span className="text-[10px] font-[600] text-text-4">MXN</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-3">{m.property.specs}</div>
                      <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-text-4">
                        {timeOnly(m.createdAt)}
                        {out && <StatusTicks status={m.status} />}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={cn("flex", out ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[74%] rounded-2xl px-3 py-2 text-sm shadow-bubble",
                      out
                        ? "rounded-br-sm border border-[color:var(--bubble-out-border)] bg-[color:var(--bubble-out-bg)] text-[color:var(--bubble-out-text)]"
                        : "rounded-bl-sm border border-[color:var(--bubble-in-border)] bg-[color:var(--bubble-in-bg)] text-text",
                    )}
                  >
                    {m.body != null ? (
                      <span className="whitespace-pre-wrap break-words">{m.body}</span>
                    ) : (
                      <span className="whitespace-pre-wrap break-words italic text-text-3">
                        {nonTextLabel(m.waType) ?? "Mensaje no compatible"}
                      </span>
                    )}
                    <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-text-4">
                      {out && m.aiGenerated && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-tint px-1 text-[9px] font-[650] text-accent-text">
                          <Bot size={9} />
                          IA
                        </span>
                      )}
                      {timeOnly(m.createdAt)}
                      {out && <StatusTicks status={m.status} />}
                    </span>
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Compositor */}
      <div className="border-t border-border bg-bg-panel px-3 py-3">
        {error && (
          <div className="mb-2 flex items-start gap-1.5 rounded-md border border-[color:var(--match-no-border)] bg-[color:var(--match-no-bg)] px-2.5 py-1.5 text-[11.5px] text-[color:var(--match-no-text)]">
            <AlertCircle size={13} className="mt-px shrink-0" />
            {error}
          </div>
        )}
        {!windowOpen ? (
          <div className="rounded-lg border border-dashed border-[color:var(--renta-border)] bg-[color:var(--win-closed-bg)] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-[550] text-[color:var(--win-closed-text)]">
              <AlertCircle size={13} />
              La ventana de 24 h está cerrada. Reanuda la conversación con una plantilla aprobada.
            </p>
            {(() => {
              const tpl = templates.find((t) => t.id === templateId);
              const nVars = tpl?.variables ?? 0;
              const filled = Array.from({ length: nVars }, (_, i) => tplVars[i] ?? "");
              const complete = filled.every((v) => v.trim());
              return (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={templateId}
                      onChange={(e) => {
                        setTemplateId(e.target.value);
                        setTplVars([]);
                      }}
                      className="rounded-md border border-border-strong bg-bg-panel px-2 py-1.5 text-xs text-text-2 focus:outline-none focus:ring-2 focus:ring-accent-tint"
                    >
                      <option value="">Elige una plantilla…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!templateId || sending || (nVars > 0 && !complete)}
                      onClick={() =>
                        void send(`/api/conversations/${conversationId}/messages/template`, {
                          templateId,
                          variables: filled,
                        }).then((ok) => {
                          if (ok) {
                            setTemplateId("");
                            setTplVars([]);
                          }
                        })
                      }
                      className="rounded-md bg-ink px-3 py-1.5 text-xs font-[550] text-white hover:bg-ink-hover disabled:opacity-50"
                    >
                      Enviar plantilla
                    </button>
                  </div>
                  {nVars > 0 && (
                    <div className="space-y-1.5">
                      {Array.from({ length: nVars }, (_, i) => (
                        <input
                          key={i}
                          value={tplVars[i] ?? ""}
                          onChange={(e) =>
                            setTplVars((prev) => {
                              const next = [...prev];
                              while (next.length < nVars) next.push("");
                              next[i] = e.target.value;
                              return next;
                            })
                          }
                          placeholder={`Valor para {{${i + 1}}}`}
                          className="block w-full rounded-md border border-border bg-bg-panel px-2 py-1 text-xs text-text focus:outline-none focus:ring-2 focus:ring-accent-tint"
                        />
                      ))}
                    </div>
                  )}
                  {tpl && (
                    <p className="whitespace-pre-wrap rounded-md bg-[color:var(--win-closed-bg)] px-2 py-1.5 text-[11.5px] text-text-3">
                      {renderBody(tpl.body, filled.map((v, i) => v.trim() || `{{${i + 1}}}`))}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-3 transition-colors hover:bg-bg-hover"
              aria-label="Adjuntar"
            >
              <Paperclip size={17} />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              rows={1}
              placeholder="Escribe un mensaje…"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-tint"
            />
            <button
              type="button"
              disabled={!text.trim() || sending}
              onClick={sendText}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink text-white transition-colors hover:bg-ink-hover disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
