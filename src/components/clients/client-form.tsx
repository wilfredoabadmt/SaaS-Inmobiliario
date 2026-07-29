"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { TYPO } from "@/lib/design/typography";
import type { ClientListItem } from "@/lib/clients/types";
import { cn } from "@/lib/utils";

interface Props {
  mode: "create" | "edit";
  /** En edición, al menos `id` (los demás campos se recargan del detalle, incl. notas). */
  client?: ClientListItem | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

const FIELD =
  "w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-text placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-tint";

/** Form de alta/edición de contacto (feature 009, US1). Valida en servidor; muestra 409. */
export function ClientForm({ mode, client, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>({
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: "",
  });
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // En edición, cargar el detalle completo (incluye notas) para poblar el form.
  useEffect(() => {
    if (mode !== "edit" || !client) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${client.id}`);
        if (res.ok && active) {
          const d = (await res.json()) as {
            name: string | null;
            phone: string;
            email: string | null;
            notes: string | null;
          };
          setForm({ name: d.name ?? "", phone: d.phone, email: d.email ?? "", notes: d.notes ?? "" });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [mode, client]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (saving) return;
    setError(null);
    if (form.phone.replace(/\D/g, "").length < 8) {
      setError("El teléfono es obligatorio (mínimo 8 dígitos).");
      return;
    }
    setSaving(true);
    try {
      const url = mode === "create" ? "/api/clients" : `/api/clients/${client!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        onSaved();
        return;
      }
      if (res.status === 409) {
        setError("Ya existe un contacto con ese teléfono en tu organización.");
        return;
      }
      const d = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(d?.error?.message ?? "No se pudo guardar. Revisa los datos.");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-bg-panel shadow-ficha"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className={TYPO.section}>{mode === "create" ? "Nuevo contacto" : "Editar contacto"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-3 hover:bg-bg-hover"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {error && (
            <div className="flex items-start gap-1.5 rounded-md border border-[color:var(--match-no-border)] bg-[color:var(--match-no-bg)] px-2.5 py-1.5 text-[12px] text-[color:var(--match-no-text)]">
              <AlertCircle size={13} className="mt-px shrink-0" />
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[12px] font-[600] text-text-3">Nombre</span>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nombre del contacto"
              disabled={loading}
              className={FIELD}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-[600] text-text-3">
              Teléfono <span className="text-[color:var(--match-no-text)]">*</span>
            </span>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="52 1 55 1234 5678"
              inputMode="tel"
              disabled={loading}
              className={FIELD}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-[600] text-text-3">Correo</span>
            <input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="correo@ejemplo.com"
              inputMode="email"
              disabled={loading}
              className={FIELD}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-[600] text-text-3">Notas</span>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notas internas…"
              rows={3}
              disabled={loading}
              className={cn(FIELD, "resize-none")}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-strong bg-bg px-3 py-1.5 text-[13px] font-[550] text-text-2 hover:bg-bg-hover"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || loading}
            className="rounded-lg bg-ink px-4 py-1.5 text-[13px] font-[550] text-white hover:bg-ink-hover disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
