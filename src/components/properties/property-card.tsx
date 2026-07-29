import { PropertyThumb } from "@/components/properties/property-thumb";
import { OperationBadge, PropertyStatusBadge } from "@/components/ui/badge";
import type { PropertyView } from "@/lib/inbox/types";

/** Tarjeta de propiedad (vista de inventario). */
export function PropertyCard({ property: p }: { property: PropertyView }) {
  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-bg-panel shadow-rest transition-shadow hover:shadow-lift">
      <div className="relative">
        <PropertyThumb seed={p.photoSeed} photoUrl={p.photoUrl} className="h-36 w-full" iconSize={30} />
        <div className="absolute left-2 top-2">
          <PropertyStatusBadge status={p.status} className="bg-bg-panel/90 backdrop-blur" />
        </div>
        <div className="absolute right-2 top-2">
          <OperationBadge operation={p.operation} className="bg-bg-panel/90 backdrop-blur" />
        </div>
      </div>
      <div className="p-3">
        <h3 className="truncate text-[13.5px] font-[600] text-text">{p.title}</h3>
        <p className="mt-0.5 truncate text-[12px] text-text-3">
          {p.zone} · {p.type}
        </p>
        <div className="mt-2 text-[18px] font-[700] text-text">
          {p.priceLabel} <span className="text-[11px] font-[600] text-text-4">MXN</span>
        </div>
        <p className="mt-1 text-[11.5px] text-text-3">{p.specs}</p>
      </div>
    </div>
  );
}
