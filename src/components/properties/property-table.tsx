import { PropertyThumb } from "@/components/properties/property-thumb";
import { OperationBadge, PropertyStatusBadge } from "@/components/ui/badge";
import type { PropertyView } from "@/lib/inbox/types";

/** Tabla de propiedades (vista de inventario). */
export function PropertyTable({ properties }: { properties: PropertyView[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-panel shadow-rest">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] font-[650] uppercase tracking-wide text-text-4">
            <th className="px-4 py-2.5 font-[650]">Propiedad</th>
            <th className="px-4 py-2.5 font-[650]">Operación</th>
            <th className="px-4 py-2.5 font-[650]">Zona</th>
            <th className="px-4 py-2.5 font-[650]">Precio</th>
            <th className="px-4 py-2.5 font-[650]">Estatus</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0 hover:bg-bg-hover">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <PropertyThumb
                    seed={p.photoSeed}
                    photoUrl={p.photoUrl}
                    iconSize={14}
                    className="h-9 w-9 shrink-0 rounded-md"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-[600] text-text">{p.title}</div>
                    <div className="truncate text-[11px] text-text-4">{p.type}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5">
                <OperationBadge operation={p.operation} />
              </td>
              <td className="px-4 py-2.5 text-text-2">{p.zone}</td>
              <td className="px-4 py-2.5 font-[700] text-text">{p.priceLabel}</td>
              <td className="px-4 py-2.5">
                <PropertyStatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
