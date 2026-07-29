import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TYPO } from "@/lib/design/typography";

/** Contenedor común de las sub-páginas de Configuración (feature 013). */
export function SettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[640px] px-8 py-8">
        <Link
          href="/settings"
          className="mb-4 inline-flex items-center gap-1 text-[12.5px] text-text-3 hover:text-text-2"
        >
          <ChevronLeft size={14} /> Configuración
        </Link>
        <h1 className={TYPO.h1}>{title}</h1>
        {description && <p className="mt-1 text-sm text-text-3">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
