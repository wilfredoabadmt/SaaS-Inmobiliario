import Link from "next/link";

/**
 * Footer compartido para todas las páginas públicas (landing + legales).
 * Sin auth, sin datos de negocio. Estático.
 */
export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-bg-panel">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Marca */}
          <div>
            <Link
              href="/"
              className="text-base font-[650] text-accent-text hover:text-accent transition-colors"
            >
              Inmox
            </Link>
            <p className="mt-1 text-xs text-text-3">
              CRM inmobiliario con WhatsApp como canal principal.
            </p>
          </div>

          {/* Navegación legal */}
          <nav aria-label="Páginas legales">
            <ul className="flex flex-wrap gap-4">
              <li>
                <Link
                  href="/privacidad"
                  className="text-sm text-text-2 hover:text-accent transition-colors"
                >
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link
                  href="/terminos"
                  className="text-sm text-text-2 hover:text-accent transition-colors"
                >
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link
                  href="/eliminacion-de-datos"
                  className="text-sm text-text-2 hover:text-accent transition-colors"
                >
                  Eliminación de datos
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <p className="mt-6 text-center text-xs text-text-4">
          &copy; {year} Inmox. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
