import { PublicFooter } from "@/components/public/public-footer";
import Link from "next/link";

/**
 * Layout para las páginas públicas legales: privacidad, términos,
 * eliminación de datos. Sin auth. Estático para crawlers y el validador de Meta.
 */
export default function PublicLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Encabezado mínimo */}
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-base font-[650] text-accent-text hover:text-accent transition-colors"
            aria-label="Inmox — inicio"
          >
            Inmox
          </Link>
          <Link
            href="/login"
            className="text-sm text-text-2 hover:text-accent transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <PublicFooter />
    </div>
  );
}
