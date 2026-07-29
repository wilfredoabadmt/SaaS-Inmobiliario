"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { OPERATION_TYPES, PROPERTY_TYPES } from "@/lib/properties/schemas";

const TYPE_LABEL: Record<string, string> = {
  casa: "Casa",
  departamento: "Departamento",
  local: "Local",
  terreno: "Terreno",
};

const selectCls =
  "h-9 w-full rounded-sm border border-border bg-bg px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-[550] text-text-3">{label}</span>
      {children}
    </label>
  );
}

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Editor manual de requisitos de un cliente (US5). Se abre desde el panel de match
 * inverso. Merge en el servidor: los campos vacíos NO tocan lo previo (source="manual").
 */
export function RequirementsForm({
  clientId,
  clientName,
  onClose,
  onSaved,
}: {
  clientId: string;
  clientName: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    operation: "",
    budgetMin: "",
    budgetMax: "",
    zone: "",
    propertyType: "",
    bedrooms: "",
    bathrooms: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const budgetMin = numOrNull(f.budgetMin);
    const budgetMax = numOrNull(f.budgetMax);
    if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) {
      setError("El presupuesto mínimo no puede ser mayor al máximo.");
      return;
    }
    // Solo envía campos con valor (merge en el servidor).
    const payload: Record<string, unknown> = {};
    if (f.operation) payload.operation = f.operation;
    if (budgetMin != null) payload.budgetMin = budgetMin;
    if (budgetMax != null) payload.budgetMax = budgetMax;
    if (f.zone.trim()) payload.zone = f.zone.trim();
    if (f.propertyType) payload.propertyType = f.propertyType;
    if (numOrNull(f.bedrooms) != null) payload.bedrooms = numOrNull(f.bedrooms);
    if (numOrNull(f.bathrooms) != null) payload.bathrooms = numOrNull(f.bathrooms);
    if (f.notes.trim()) payload.notes = f.notes.trim();

    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/requirements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? "No se pudieron guardar los requisitos.");
        return;
      }
      onSaved();
    } catch {
      setError("Error de red al guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Requisitos de ${clientName ?? "cliente"}`} widthClass="max-w-lg">
      <p className="mb-3 text-[12px] text-text-3">
        Solo los campos que llenes se actualizan; lo demás se conserva.
      </p>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Operación">
          <select className={selectCls} value={f.operation} onChange={(e) => set("operation", e.target.value)}>
            <option value="">— sin cambio —</option>
            {OPERATION_TYPES.map((o) => (
              <option key={o} value={o}>{o === "venta" ? "Venta" : "Renta"}</option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select className={selectCls} value={f.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
            <option value="">— sin cambio —</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Presupuesto mín.">
          <Input value={f.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Presupuesto máx.">
          <Input value={f.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} inputMode="decimal" />
        </Field>
        <div className="col-span-2">
          <Field label="Zona (colonia/ciudad, separa con coma)">
            <Input value={f.zone} onChange={(e) => set("zone", e.target.value)} placeholder="Del Valle, Narvarte" />
          </Field>
        </div>
        <Field label="Recámaras (mín.)">
          <Input value={f.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Baños (mín.)">
          <Input value={f.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} inputMode="decimal" />
        </Field>
        <div className="col-span-2">
          <Field label="Notas">
            <Input value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>

        {error && <p className="col-span-2 text-[12.5px] text-red-500">{error}</p>}

        <div className="col-span-2 mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar requisitos"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
