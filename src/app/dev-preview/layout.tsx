import { notFound } from "next/navigation";
import { PreviewShell } from "@/components/dev/preview-shell";

/**
 * Layout dev-only: envuelve todas las vistas de /dev-preview en el riel del shell,
 * con datos de muestra y sin auth/DB. NUNCA se sirve en producción.
 */
export default function DevPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewShell>{children}</PreviewShell>;
}
