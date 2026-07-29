"use client";

import { useCallback, useState } from "react";
import { BarChart3, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TemplateComponents } from "@/lib/meta/templates";
import { TemplateBuilder } from "@/components/templates/template-builder";
import { TemplateStats } from "@/components/templates/template-stats";

export interface TemplateView {
  id: string;
  name: string;
  waTemplateName: string;
  language: string;
  category: string | null;
  status: string | null;
  rejectedReason: string | null;
  qualityRating: string | null;
  components: TemplateComponents | null;
  lastSyncedAt: string | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: "Aprobada", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING: { label: "Pendiente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  REJECTED: { label: "Rechazada", cls: "bg-red-50 text-red-700 border-red-200" },
  PAUSED: { label: "Pausada", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  DISABLED: { label: "Deshabilitada", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  not_found: { label: "No encontrada", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
};

function StatusBadge({ status }: { status: string | null }) {
  const meta = status ? STATUS_META[status] : null;
  const label = meta?.label ?? (status === null ? "Sin sincronizar" : status);
  const cls = meta?.cls ?? "bg-zinc-100 text-zinc-600 border-zinc-200";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-[650] uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidad",
  AUTHENTICATION: "Autenticación",
};

export function TemplatesClient({
  initialTemplates,
  canManage,
  connected,
}: {
  initialTemplates: TemplateView[];
  canManage: boolean;
  connected: boolean;
}) {
  const [templates, setTemplates] = useState<TemplateView[]>(initialTemplates);
  const [showBuilder, setShowBuilder] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [statsFor, setStatsFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    if (!window.confirm("¿Eliminar esta plantilla? Se borrará también en WhatsApp.")) return;
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setNotice(d?.error?.message ?? "No se pudo eliminar");
        return;
      }
      setTemplates((prev) => prev.filter((x) => x.id !== id));
    } catch {
      setNotice("No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  }

  const refresh = useCallback(async () => {
    const res = await fetch("/api/templates");
    if (res.ok) {
      const data = await res.json();
      setTemplates((data.templates as TemplateView[]) ?? []);
    }
  }, []);

  async function sync() {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/templates/sync", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice(data?.error?.message ?? "No se pudo sincronizar");
        return;
      }
      await refresh();
    } catch {
      setNotice("No se pudo sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mt-6">
      {!connected && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-800">
          Conecta WhatsApp en Configuración para crear y administrar plantillas.
        </div>
      )}

      <div className="flex items-center gap-3">
        {canManage && (
          <Button size="sm" disabled={!connected} onClick={() => setShowBuilder((v) => !v)}>
            <Plus size={14} /> Nueva plantilla
          </Button>
        )}
        {canManage && (
          <Button size="sm" variant="ghost" disabled={!connected || syncing} onClick={sync}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : undefined} /> Sincronizar
          </Button>
        )}
        {notice && <span className="text-[12px] text-red-500">{notice}</span>}
      </div>

      {showBuilder && canManage && (
        <TemplateBuilder
          onCreated={() => {
            setShowBuilder(false);
            void refresh();
          }}
          onCancel={() => setShowBuilder(false)}
        />
      )}

      <div className="mt-5 space-y-3">
        {templates.length === 0 ? (
          <p className="text-[13px] text-text-3">Aún no tienes plantillas. Crea la primera para enviarla a revisión.</p>
        ) : (
          templates.map((t) => (
            <article key={t.id} className="rounded-lg border border-border bg-bg-panel p-4 shadow-rest">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-[650] text-text">{t.name}</h3>
                  <p className="mt-0.5 font-mono text-[11.5px] text-text-4">
                    {t.waTemplateName} · {t.language}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {t.category && (
                    <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10.5px] font-[550] text-text-3">
                      {CATEGORY_LABEL[t.category] ?? t.category}
                    </span>
                  )}
                  <StatusBadge status={t.status} />
                </div>
              </div>
              {t.components?.body?.text && (
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-[12.5px] text-text-2">
                  {t.components.body.text}
                </p>
              )}
              {t.status === "REJECTED" && t.rejectedReason && (
                <p className="mt-2 rounded-sm bg-red-50 px-2 py-1 text-[11.5px] text-red-700">
                  Rechazada: {t.rejectedReason}
                </p>
              )}
              <div className="mt-3 flex items-center gap-4">
                <button
                  onClick={() => setStatsFor((s) => (s === t.id ? null : t.id))}
                  className="flex items-center gap-1 text-[12px] text-text-3 hover:text-text"
                >
                  <BarChart3 size={13} /> Estadísticas
                </button>
                {canManage && (
                  <button
                    onClick={() => remove(t.id)}
                    disabled={busyId === t.id}
                    className="flex items-center gap-1 text-[12px] text-text-3 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Eliminar
                  </button>
                )}
              </div>
              {statsFor === t.id && <TemplateStats templateId={t.id} />}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
