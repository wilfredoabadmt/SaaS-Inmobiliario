"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MessageSquare, Pencil, Plus, Search } from "lucide-react";
import { ChannelBadge } from "@/components/clients/channel-badge";
import { ClientForm } from "@/components/clients/client-form";
import { TYPO } from "@/lib/design/typography";
import type { ClientListItem } from "@/lib/clients/types";
import { cn } from "@/lib/utils";

function initials(name: string | null, phone: string): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
  }
  return phone.replace(/\D/g, "").slice(-2);
}

/** Etiqueta de última actividad relativa (compacta). */
function activityLabel(iso: string | null): string {
  if (!iso) return "—";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

type FormMode = { mode: "create" } | { mode: "edit"; client: ClientListItem } | null;

/** Directorio de contactos real (feature 009): lista + badge de canal + crear/editar + archivar + atajo a la bandeja. */
export function ClientsClient({ clients }: { clients: ClientListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormMode>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedList, setArchivedList] = useState<ClientListItem[] | null>(null);
  const [loadingArchived, setLoadingArchived] = useState(false);

  async function loadArchived() {
    setLoadingArchived(true);
    try {
      const res = await fetch("/api/clients?archived=archived");
      const d = (await res.json().catch(() => null)) as { clients?: ClientListItem[] } | null;
      setArchivedList(d?.clients ?? []);
    } catch {
      setArchivedList([]);
    } finally {
      setLoadingArchived(false);
    }
  }

  function toggleArchived() {
    const next = !showArchived;
    setShowArchived(next);
    if (next && archivedList === null) void loadArchived();
  }

  const filtered = useMemo(() => {
    const source = showArchived ? (archivedList ?? []) : clients;
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (c) => (c.name ?? "").toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [clients, showArchived, archivedList, query]);

  /** Atajo "Enviar mensaje": resuelve la conversación y hace deep-link a la bandeja, que
   *  decide las reglas de canal (ventana 24h → plantilla). El módulo no reimplementa reglas. */
  async function sendMessage(c: ClientListItem) {
    if (busyId) return;
    setBusyId(c.id);
    setNotice(null);
    try {
      let conversationId = c.conversationId;
      if (!conversationId) {
        const res = await fetch(`/api/clients/${c.id}/conversation`, { method: "POST" });
        if (!res.ok) {
          setNotice("No se pudo abrir la conversación.");
          return;
        }
        const d = (await res.json()) as { conversationId: string };
        conversationId = d.conversationId;
      }
      router.push(`/inbox?c=${conversationId}`);
    } catch {
      setNotice("Error de red al abrir la conversación.");
    } finally {
      setBusyId(null);
    }
  }

  /** Archiva (soft-delete reversible) o restaura un contacto. No borra historial. */
  async function archive(c: ClientListItem, archived: boolean) {
    if (busyId) return;
    setBusyId(c.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/clients/${c.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) {
        setNotice("No se pudo actualizar el contacto.");
        return;
      }
      setNotice(archived ? "Contacto archivado." : "Contacto restaurado.");
      router.refresh(); // mantiene la lista activa (SSR) al día
      if (showArchived) await loadArchived();
      else setArchivedList(null); // invalida la caché de archivados
    } catch {
      setNotice("Error de red.");
    } finally {
      setBusyId(null);
    }
  }

  function onSaved() {
    setForm(null);
    router.refresh();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-8 py-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className={TYPO.h1}>Clientes</h1>
            <span className="rounded-full bg-bg-hover px-2 py-0.5 text-[11px] font-[600] text-text-3">
              {filtered.length}
            </span>
            <button
              type="button"
              onClick={toggleArchived}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-[600] transition-colors",
                showArchived
                  ? "bg-ink text-white"
                  : "border border-border-strong bg-bg text-text-3 hover:bg-bg-hover",
              )}
            >
              {showArchived ? "Ver activos" : "Archivados"}
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex w-72 items-center gap-2 rounded-lg border border-border-strong bg-bg-panel px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-accent-tint">
              <Search size={15} className="text-text-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o teléfono…"
                className="w-full bg-transparent text-sm text-text placeholder:text-text-4 focus:outline-none"
              />
            </div>
            {!showArchived && (
              <button
                type="button"
                onClick={() => setForm({ mode: "create" })}
                className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-[550] text-white hover:bg-ink-hover"
              >
                <Plus size={15} />
                Nuevo contacto
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-border bg-bg-panel shadow-rest">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] font-[650] uppercase tracking-wide text-text-4">
                <th className="px-4 py-2.5 font-[650]">Contacto</th>
                <th className="px-4 py-2.5 font-[650]">Correo</th>
                <th className="px-4 py-2.5 font-[650]">Última actividad</th>
                <th className="px-4 py-2.5 text-right font-[650]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-text-3">
                    {showArchived
                      ? loadingArchived
                        ? "Cargando archivados…"
                        : "No hay contactos archivados."
                      : clients.length === 0
                        ? "Aún no hay contactos. Crea el primero o espera el primer mensaje entrante."
                        : "Sin resultados."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-bg-hover">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="relative inline-flex">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--fill-avatar-sm)] text-[11px] font-[650] text-text-2">
                            {initials(c.name, c.phone)}
                          </span>
                          <ChannelBadge channel={c.channel} />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-[600] text-text">{c.name ?? c.phone}</div>
                          <div className="truncate text-[11px] text-text-4">{c.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text-2">{c.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-text-3">{activityLabel(c.lastActivityAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.archivedAt ? (
                          <button
                            type="button"
                            onClick={() => void archive(c, false)}
                            disabled={busyId === c.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-bg px-2.5 py-1 text-[12px] font-[550] text-text-2 hover:bg-bg-hover disabled:opacity-50"
                          >
                            <ArchiveRestore size={13} />
                            Restaurar
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void sendMessage(c)}
                              disabled={busyId === c.id}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-bg px-2.5 py-1 text-[12px] font-[550] text-text-2 hover:bg-bg-hover disabled:opacity-50"
                            >
                              <MessageSquare size={13} />
                              Enviar mensaje
                            </button>
                            <button
                              type="button"
                              onClick={() => setForm({ mode: "edit", client: c })}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-text-3 hover:bg-bg-hover"
                              aria-label="Editar"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void archive(c, true)}
                              disabled={busyId === c.id}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-text-3 hover:bg-bg-hover disabled:opacity-50"
                              aria-label="Archivar"
                              title="Archivar"
                            >
                              <Archive size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <ClientForm
          mode={form.mode}
          client={form.mode === "edit" ? form.client : null}
          onClose={() => setForm(null)}
          onSaved={onSaved}
        />
      )}

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-bg-panel px-4 py-2 text-[12.5px] font-[600] text-text-2 shadow-ficha">
          {notice}
        </div>
      )}
    </div>
  );
}
