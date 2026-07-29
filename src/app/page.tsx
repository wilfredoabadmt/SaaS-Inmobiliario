import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/components/public/public-footer";
import { SessionRedirect } from "@/components/public/session-redirect";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inmox — CRM Inmobiliario con WhatsApp",
  description:
    "Gestiona tus clientes de renta y venta directamente desde WhatsApp. Bandeja unificada, pipeline de candidatos y plantillas aprobadas para agencias inmobiliarias.",
};

// Tarjetas de beneficio
const BENEFITS = [
  {
    title: "Bandeja unificada de WhatsApp",
    description:
      "Todos los chats de tus clientes en un solo lugar, sin cambiar de dispositivo ni de número.",
    accent: "venta" as const,
  },
  {
    title: "Multi-tenant por agencia",
    description:
      "Cada agencia tiene su propio espacio aislado. Invita a tu equipo y asigna roles de agente u dueño.",
    accent: "renta" as const,
  },
  {
    title: "Pipeline de candidatos",
    description:
      "Rastrea cada candidatura desde el primer contacto hasta el cierre, vinculada a la propiedad correcta.",
    accent: "venta" as const,
  },
  {
    title: "Plantillas aprobadas por Meta",
    description:
      "Envía recordatorios y seguimientos con plantillas de WhatsApp validadas para que tus mensajes lleguen.",
    accent: "renta" as const,
  },
] as const;

type BenefitAccent = "venta" | "renta";

function BenefitCard({
  title,
  description,
  accent,
}: {
  title: string;
  description: string;
  accent: BenefitAccent;
}) {
  const isVenta = accent === "venta";
  return (
    <article
      className={
        "rounded-lg border p-6 " +
        (isVenta
          ? "border-[#ccfbf1] bg-[#f0fdfa]"
          : "border-[#fce8c8] bg-[#fff8ed]")
      }
    >
      <div
        className={
          "mb-3 inline-block rounded-full px-3 py-1 text-xs font-[600] " +
          (isVenta
            ? "bg-[#ccfbf1] text-[#115e59]"
            : "bg-[#fce8c8] text-[#9a5b00]")
        }
      >
        {isVenta ? "Venta" : "Renta"}
      </div>
      <h3 className="mb-2 text-base font-[650] text-[#1a1a1e]">{title}</h3>
      <p className="text-sm leading-relaxed text-[#56565e]">{description}</p>
    </article>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Redirige a /inbox si ya hay sesión activa (sin bloquear render estático) */}
      <SessionRedirect />

      <div className="flex min-h-screen flex-col bg-bg">
        {/* Encabezado público */}
        <header className="border-b border-border bg-bg">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="text-lg font-[650] text-accent-text hover:text-accent transition-colors"
              aria-label="Inmox — inicio"
            >
              Inmox
            </Link>
            <nav aria-label="Navegación principal">
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Iniciar sesión
                </Button>
              </Link>
            </nav>
          </div>
        </header>

        <main id="main-content">
          {/* Sección hero */}
          <section
            aria-labelledby="hero-heading"
            className="border-b border-border bg-bg-subtle"
          >
            <div className="mx-auto max-w-5xl px-6 py-20 text-center">
              {/* Badges de operación */}
              <div className="mb-6 flex justify-center gap-3">
                <span className="rounded-full bg-[#f0fdfa] px-4 py-1.5 text-xs font-[600] text-[#115e59]">
                  Venta
                </span>
                <span className="rounded-full bg-[#fff8ed] px-4 py-1.5 text-xs font-[600] text-[#9a5b00]">
                  Renta
                </span>
              </div>

              <h1
                id="hero-heading"
                className="mb-4 text-4xl font-[700] leading-tight text-[#1a1a1e] sm:text-5xl"
              >
                El CRM inmobiliario que{" "}
                <span className="text-accent">vive en WhatsApp</span>
              </h1>

              <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#56565e]">
                Gestiona tus clientes de renta y venta directamente desde
                WhatsApp. Bandeja unificada, pipeline de candidatos y plantillas
                aprobadas — todo en un solo lugar para tu agencia.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/login">
                  <Button size="default" className="px-8 py-3 text-base">
                    Iniciar sesión
                  </Button>
                </Link>
                <Link href="#beneficios">
                  <Button
                    variant="outline"
                    size="default"
                    className="px-8 py-3 text-base"
                  >
                    Ver beneficios
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Sección de beneficios */}
          <section
            id="beneficios"
            aria-labelledby="beneficios-heading"
            className="bg-bg"
          >
            <div className="mx-auto max-w-5xl px-6 py-16">
              <h2
                id="beneficios-heading"
                className="mb-3 text-center text-2xl font-[650] text-[#1a1a1e]"
              >
                Todo lo que necesita tu agencia
              </h2>
              <p className="mb-10 text-center text-sm text-[#56565e]">
                Diseñado para agentes y agencias que ya usan WhatsApp con sus
                clientes.
              </p>

              <div className="grid gap-5 sm:grid-cols-2">
                {BENEFITS.map((b) => (
                  <BenefitCard
                    key={b.title}
                    title={b.title}
                    description={b.description}
                    accent={b.accent}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Cómo funciona */}
          <section
            aria-labelledby="como-funciona-heading"
            className="border-t border-border bg-bg-subtle"
          >
            <div className="mx-auto max-w-5xl px-6 py-16">
              <h2
                id="como-funciona-heading"
                className="mb-10 text-center text-2xl font-[650] text-[#1a1a1e]"
              >
                ¿Cómo funciona?
              </h2>
              <ol className="flex flex-col gap-6 sm:flex-row">
                <li className="flex flex-1 flex-col gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ccfbf1] text-sm font-[650] text-[#115e59]">
                    1
                  </div>
                  <h3 className="text-sm font-[650] text-[#1a1a1e]">
                    Conecta tu número de WhatsApp
                  </h3>
                  <p className="text-sm text-[#56565e]">
                    Vincula tu número de WhatsApp Business a través de la API
                    oficial de Meta.
                  </p>
                </li>
                <li className="flex flex-1 flex-col gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ccfbf1] text-sm font-[650] text-[#115e59]">
                    2
                  </div>
                  <h3 className="text-sm font-[650] text-[#1a1a1e]">
                    Registra tus propiedades
                  </h3>
                  <p className="text-sm text-[#56565e]">
                    Agrega las propiedades en renta y venta y asígnalas a los
                    agentes de tu equipo.
                  </p>
                </li>
                <li className="flex flex-1 flex-col gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ccfbf1] text-sm font-[650] text-[#115e59]">
                    3
                  </div>
                  <h3 className="text-sm font-[650] text-[#1a1a1e]">
                    Atiende desde la bandeja
                  </h3>
                  <p className="text-sm text-[#56565e]">
                    Responde, filtra candidatos y haz seguimiento desde una
                    bandeja de WhatsApp unificada.
                  </p>
                </li>
              </ol>
            </div>
          </section>

          {/* CTA final */}
          <section
            aria-labelledby="cta-heading"
            className="border-t border-border bg-bg"
          >
            <div className="mx-auto max-w-5xl px-6 py-16 text-center">
              <h2
                id="cta-heading"
                className="mb-4 text-2xl font-[650] text-[#1a1a1e]"
              >
                Empieza a gestionar tu agencia hoy
              </h2>
              <p className="mb-8 text-sm text-[#56565e]">
                Accede a tu cuenta o solicita acceso a tu administrador.
              </p>
              <Link href="/login">
                <Button size="default" className="px-10 py-3 text-base">
                  Iniciar sesión
                </Button>
              </Link>
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
}
