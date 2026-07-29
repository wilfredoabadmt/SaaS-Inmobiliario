"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { PropertyForm } from "@/components/properties/property-form";
import { PropertyPhotosEditor } from "@/components/properties/property-photos-editor";
import { MatchingClientsPanel } from "@/components/properties/matching-clients-panel";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { OperationBadge, PropertyStatusBadge } from "@/components/ui/badge";
import type { PropertyDetail } from "@/lib/inbox/types";

const TYPE_LABEL: Record<string, string> = {
  casa: "Casa",
  departamento: "Departamento",
  local: "Local",
  terreno: "Terreno",
};

function money(price: string, currency: string): string {
  const n = Number(price);
  const f = Number.isFinite(n) ? n.toLocaleString("es-MX", { maximumFractionDigits: 0 }) : price;
  return `$${f} ${currency}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px]">
      <span className="text-text-3">{label}</span>
      <span className="text-right font-[500] text-text-2">{value}</span>
    </div>
  );
}

/**
 * Hoja de detalle de una propiedad (US3): todos los campos + galería editable + clientes
 * que hacen match (US4). Se abre al desplegar una tarjeta. Carga el detalle por id.
 */
export function PropertyDetailSheet({
  propertyId,
  onClose,
  onChanged,
}: {
  propertyId: string;
  onClose: () => void;
  /** Notifica al inventario para refrescar (cambió foto principal, datos, estatus…). */
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}`);
    if (res.ok) setDetail((await res.json()) as PropertyDetail);
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleClose() {
    onChanged();
    onClose();
  }

  if (editing && detail) {
    return (
      <PropertyForm
        initial={detail}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void load();
          onChanged();
        }}
      />
    );
  }

  const zone = detail ? [detail.neighborhood, detail.city].filter(Boolean).join(", ") : "";
  const specs = detail
    ? [
        detail.bedrooms != null ? `${detail.bedrooms} rec` : null,
        detail.bathrooms != null ? `${Number(detail.bathrooms)} baños` : null,
        detail.builtAreaM2 != null ? `${Number(detail.builtAreaM2)} m² const.` : null,
        detail.lotAreaM2 != null ? `${Number(detail.lotAreaM2)} m² lote` : null,
        detail.parkingSpaces != null ? `${detail.parkingSpaces} estac.` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Modal
      open
      onClose={handleClose}
      title={detail?.title ?? "Detalle de propiedad"}
      widthClass="max-w-3xl"
    >
      {!detail ? (
        <p className="py-10 text-center text-sm text-text-3">Cargando…</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Columna izquierda: datos */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <PropertyStatusBadge status={detail.status} />
              <OperationBadge operation={detail.operationType} />
              {detail.archivedAt && (
                <span className="rounded-full bg-bg-hover px-2 py-0.5 text-[11px] font-[600] text-text-3">
                  Archivada
                </span>
              )}
            </div>
            <div className="text-[20px] font-[700] text-text">
              {money(detail.price, detail.currency)}
            </div>
            <div className="mt-2 divide-y divide-border">
              <Row label="Tipo" value={TYPE_LABEL[detail.propertyType] ?? detail.propertyType} />
              <Row label="Zona" value={zone || "—"} />
              <Row label="Dirección" value={detail.address} />
              <Row label="Características" value={specs || "—"} />
              <Row label="Descripción" value={detail.description} />
            </div>
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={13} /> Editar
              </Button>
            </div>

            <div className="mt-5">
              <MatchingClientsPanel propertyId={detail.id} />
            </div>
          </div>

          {/* Columna derecha: fotos */}
          <div>
            <PropertyPhotosEditor propertyId={detail.id} photos={detail.photos} />
          </div>
        </div>
      )}
    </Modal>
  );
}
