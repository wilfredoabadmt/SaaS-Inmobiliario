import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Banner de SLA (bronce): alerta de leads sin responder por encima del umbral
 * (~30 min, ajustable). Solo se muestra si count > 0.
 */
export function SlaBanner({ count, href = "/inbox" }: { count: number; href?: string }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[color:var(--renta-border)] bg-[color:var(--renta-tint)] px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--renta)] text-white">
        <AlertTriangle size={16} />
      </span>
      <p className="flex-1 text-[13px] font-[550] text-[color:var(--renta-text)]">
        {count} {count === 1 ? "lead sin responder" : "leads sin responder"} hace más de 30 min
      </p>
      <Link
        href={href}
        className="rounded-md bg-[color:var(--renta)] px-3 py-1.5 text-[12px] font-[550] text-white transition-opacity hover:opacity-90"
      >
        Revisar
      </Link>
    </div>
  );
}
