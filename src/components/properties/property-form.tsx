"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  OPERATION_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from "@/lib/properties/schemas";
import type { PropertyDetail } from "@/lib/inbox/types";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  casa: "Casa",
  departamento: "Departamento",
  local: "Local",
  terreno: "Terreno",
};
const STATUS_LABEL: Record<string, string> = {
  disponible: "Disponible",
  apartada: "Apartada",
  cerrada: "Cerrada",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-[550] text-text-3">{label}</span>
      {children}
    </label>
  );
}

const selectCls =
  "h-9 w-full rounded-sm border border-border bg-bg px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));
const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Formulario de crear/editar propiedad (US1). En modo edición precarga `initial`
 * (PropertyDetail). Valida lo mínimo en cliente; el servidor revalida con Zod.
 */
export function PropertyForm({
  initial,
  onClose,
  onSaved,
}: {
  /** undefined = crear; PropertyDetail = editar. */
  initial?: PropertyDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(initial);
  const [f, setF] = useState({
    operationType: initial?.operationType ?? "venta",
    propertyType: initial?.propertyType ?? "departamento",
    title: str(initial?.title),
    price: str(initial?.price),
    currency: initial?.currency ?? "MXN",
    address: str(initial?.address),
    neighborhood: str(initial?.neighborhood),
    city: str(initial?.city),
    bedrooms: str(initial?.bedrooms),
    bathrooms: str(initial?.bathrooms),
    builtAreaM2: str(initial?.builtAreaM2),
    lotAreaM2: str(initial?.lotAreaM2),
    parkingSpaces: str(initial?.parkingSpaces),
    description: str(initial?.description),
    status: initial?.status ?? "disponible",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const price = numOrNull(f.price);
    if (price == null || price <= 0) {
      setError("El precio debe ser un número mayor a 0.");
      return;
    }
    const payload = {
      operationType: f.operationType,
      propertyType: f.propertyType,
      title: f.title.trim() || null,
      price,
      currency: f.currency.trim() || "MXN",
      address: f.address.trim() || null,
      neighborhood: f.neighborhood.trim() || null,
      city: f.city.trim() || null,
      bedrooms: numOrNull(f.bedrooms),
      bathrooms: numOrNull(f.bathrooms),
      builtAreaM2: numOrNull(f.builtAreaM2),
      lotAreaM2: numOrNull(f.lotAreaM2),
      parkingSpaces: numOrNull(f.parkingSpaces),
      description: f.description.trim() || null,
      status: f.status,
    };
    setBusy(true);
    try {
      const res = await fetch(editing ? `/api/properties/${initial!.id}` : "/api/properties", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? "No se pudo guardar la propiedad.");
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
    <Modal open onClose={onClose} title={editing ? "Editar propiedad" : "Nueva propiedad"} widthClass="max-w-2xl">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Operación">
          <select className={selectCls} value={f.operationType} onChange={(e) => set("operationType", e.target.value as typeof f.operationType)}>
            {OPERATION_TYPES.map((o) => (
              <option key={o} value={o}>{o === "venta" ? "Venta" : "Renta"}</option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select className={selectCls} value={f.propertyType} onChange={(e) => set("propertyType", e.target.value as typeof f.propertyType)}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Field>

        <div className="col-span-2">
          <Field label="Título">
            <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Depto en Del Valle" />
          </Field>
        </div>

        <Field label="Precio *">
          <Input value={f.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" placeholder="4200000" />
        </Field>
        <Field label="Moneda">
          <Input value={f.currency} onChange={(e) => set("currency", e.target.value)} placeholder="MXN" />
        </Field>

        <div className="col-span-2">
          <Field label="Dirección">
            <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
        <Field label="Colonia">
          <Input value={f.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
        </Field>
        <Field label="Ciudad">
          <Input value={f.city} onChange={(e) => set("city", e.target.value)} />
        </Field>

        <Field label="Recámaras">
          <Input value={f.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Baños">
          <Input value={f.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Área construida (m²)">
          <Input value={f.builtAreaM2} onChange={(e) => set("builtAreaM2", e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Área de lote (m²)">
          <Input value={f.lotAreaM2} onChange={(e) => set("lotAreaM2", e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Estacionamientos">
          <Input value={f.parkingSpaces} onChange={(e) => set("parkingSpaces", e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Estatus">
          <select className={selectCls} value={f.status} onChange={(e) => set("status", e.target.value as typeof f.status)}>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </Field>

        <div className="col-span-2">
          <Field label="Descripción">
            <textarea
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className={cn(selectCls, "h-auto py-2 resize-y")}
            />
          </Field>
        </div>

        {error && <p className="col-span-2 text-[12.5px] text-red-500">{error}</p>}

        <div className="col-span-2 mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : editing ? "Guardar cambios" : "Crear propiedad"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
