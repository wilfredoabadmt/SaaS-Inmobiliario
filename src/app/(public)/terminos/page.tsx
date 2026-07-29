import type { Metadata } from "next";
import { LegalNotice } from "@/components/public/legal-notice";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Términos y condiciones — Inmox",
  description:
    "Términos de uso del servicio Inmox: CRM inmobiliario con WhatsApp como canal principal.",
};

export default function TerminosPage() {
  return (
    <article className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <p className="mb-2 text-xs text-[#8c8c95]">Última actualización: 15 de junio de 2026</p>
        <h1 className="text-3xl font-[700] text-[#1a1a1e]">
          Términos y condiciones de uso
        </h1>
        <p className="mt-3 text-base text-[#56565e]">
          Estos Términos y condiciones regulan el acceso y uso de{" "}
          <strong>Inmox</strong>, un CRM inmobiliario en modalidad SaaS (Software
          como Servicio) con WhatsApp como canal principal de comunicación. Al
          acceder o usar la plataforma, aceptas estos Términos en su totalidad.
        </p>
      </header>

      <LegalNotice />

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-[#1a1a1e]">
        {/* 1 */}
        <section aria-labelledby="t-sec-servicio">
          <h2
            id="t-sec-servicio"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            1. Descripción del servicio
          </h2>
          <p className="mb-3 text-[#56565e]">
            Inmox es una plataforma SaaS multi-tenant diseñada para agencias
            inmobiliarias y agentes independientes. El servicio incluye:
          </p>
          <ul className="mb-3 list-disc space-y-1 pl-6 text-[#56565e]">
            <li>Bandeja de conversaciones de WhatsApp unificada por agencia.</li>
            <li>Gestión de propiedades (renta y venta) y candidaturas de clientes.</li>
            <li>
              Integración con WhatsApp Cloud API de Meta para el envío y
              recepción de mensajes mediante plantillas aprobadas por Meta.
            </li>
            <li>Pipeline de seguimiento de candidatos y muestras de propiedades.</li>
            <li>
              Almacenamiento de archivos adjuntos (fotos, documentos) en
              servicio de objetos S3-compatible.
            </li>
            <li>Control de acceso multi-tenant por organización (agencia), con roles de dueño y agente.</li>
          </ul>
          <div className="rounded-lg border border-[#fce8c8] bg-[#fff8ed] px-5 py-4">
            <p className="text-sm font-[650] text-[#9a5b00]">
              Limitación esencial del servicio:
            </p>
            <p className="mt-1 text-sm text-[#9a5b00]">
              Inmox <strong>no genera, redacta ni valida contratos de arrendamiento
              o compraventa</strong>. La plataforma únicamente permite registrar y
              rastrear el estado documental de las transacciones (por ejemplo, si
              un documento fue enviado, firmado o recibido). La elaboración,
              revisión y firma de contratos es responsabilidad exclusiva de las
              partes involucradas y, en su caso, de sus asesores legales.
            </p>
          </div>
        </section>

        {/* 2 */}
        <section aria-labelledby="t-sec-cuenta">
          <h2
            id="t-sec-cuenta"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            2. Registro y cuenta
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[#56565e]">
            <li>
              Para usar la plataforma debes crear una cuenta con información
              veraz, completa y actualizada.
            </li>
            <li>
              Eres responsable de mantener la confidencialidad de tus
              credenciales de acceso y de todas las acciones realizadas bajo tu
              cuenta.
            </li>
            <li>
              Cada organización (agencia) dentro de la plataforma tiene un dueño
              ({'"owner"'}) que puede invitar agentes y administrar la
              configuración de WhatsApp.
            </li>
            <li>
              Notifícanos de inmediato ante cualquier uso no autorizado de tu
              cuenta.
            </li>
          </ul>
        </section>

        {/* 3 */}
        <section aria-labelledby="t-sec-uso-aceptable">
          <h2
            id="t-sec-uso-aceptable"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            3. Uso aceptable
          </h2>
          <p className="mb-3 text-[#56565e]">
            Al usar Inmox te comprometes a:
          </p>
          <ul className="mb-4 list-disc space-y-1 pl-6 text-[#56565e]">
            <li>
              Usar la plataforma exclusivamente para actividades inmobiliarias
              lícitas.
            </li>
            <li>
              Cumplir con las{" "}
              <a
                href="https://developers.facebook.com/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Políticas de la Plataforma de Meta
              </a>{" "}
              y los{" "}
              <a
                href="https://www.whatsapp.com/legal/business-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Términos de WhatsApp Business
              </a>{" "}
              en todo momento.
            </li>
            <li>
              Obtener el consentimiento adecuado de tus clientes antes de
              enviarles mensajes de WhatsApp a través de la plataforma, conforme
              a las políticas de Meta y la normativa de protección de datos
              aplicable.
            </li>
            <li>
              Usar únicamente plantillas de mensajes de WhatsApp aprobadas por
              Meta.
            </li>
            <li>
              No enviar mensajes masivos no solicitados (spam) ni usar la
              plataforma para fines distintos a la gestión inmobiliaria.
            </li>
          </ul>
          <p className="mb-3 text-[#56565e]">
            Queda <strong>prohibido</strong>:
          </p>
          <ul className="list-disc space-y-1 pl-6 text-[#56565e]">
            <li>Intentar eludir las medidas de seguridad o los controles de acceso de la plataforma.</li>
            <li>Acceder a datos de otras organizaciones (tenants).</li>
            <li>Usar la plataforma para actividades ilegales, fraudulentas o que violen derechos de terceros.</li>
            <li>Realizar ingeniería inversa del software.</li>
            <li>Compartir credenciales de acceso con personas no autorizadas.</li>
          </ul>
        </section>

        {/* 4 */}
        <section aria-labelledby="t-sec-whatsapp">
          <h2
            id="t-sec-whatsapp"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            4. Responsabilidades respecto a WhatsApp
          </h2>
          <p className="mb-3 text-[#56565e]">
            Inmox actúa como intermediario técnico entre tu agencia y la
            WhatsApp Cloud API de Meta. En consecuencia:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[#56565e]">
            <li>
              <strong>Eres el único responsable</strong> de las comunicaciones
              que envíes a través de la plataforma, incluyendo el cumplimiento
              de las políticas de contenido de WhatsApp y Meta.
            </li>
            <li>
              Una suspensión o restricción de tu cuenta de WhatsApp Business por
              parte de Meta no genera responsabilidad para Inmox.
            </li>
            <li>
              Las plantillas de mensajes deben ser aprobadas por Meta antes de
              su uso; Inmox no garantiza la aprobación de ninguna plantilla.
            </li>
            <li>
              El token de acceso de WhatsApp vinculado a tu cuenta se almacena
              cifrado en la plataforma. Eres responsable de mantener el acceso a
              tu cuenta de Meta.
            </li>
          </ul>
        </section>

        {/* 5 */}
        <section aria-labelledby="t-sec-propiedad">
          <h2
            id="t-sec-propiedad"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            5. Propiedad intelectual
          </h2>
          <p className="mb-3 text-[#56565e]">
            Todos los derechos sobre el software, diseño y marca de Inmox son
            propiedad del operador. No se otorga ninguna licencia sobre dichos
            activos más allá del derecho de uso del servicio conforme a estos
            Términos.
          </p>
          <p className="text-[#56565e]">
            Los datos que introduces en la plataforma (información de clientes,
            propiedades, conversaciones) son de tu propiedad. Inmox los procesa
            únicamente para la prestación del servicio.
          </p>
        </section>

        {/* 6 */}
        <section aria-labelledby="t-sec-disponibilidad">
          <h2
            id="t-sec-disponibilidad"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            6. Disponibilidad del servicio
          </h2>
          <p className="text-[#56565e]">
            Hacemos esfuerzos razonables para mantener la plataforma disponible,
            pero no garantizamos una disponibilidad ininterrumpida. Podremos
            realizar mantenimientos planificados con previo aviso. La
            disponibilidad del canal de WhatsApp también depende de la
            infraestructura de Meta, sobre la cual no tenemos control.
          </p>
        </section>

        {/* 7 */}
        <section aria-labelledby="t-sec-limitacion">
          <h2
            id="t-sec-limitacion"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            7. Limitación de responsabilidad
          </h2>
          <p className="mb-3 text-[#56565e]">
            En la medida máxima permitida por la ley aplicable:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[#56565e]">
            <li>
              Inmox no será responsable por daños indirectos, incidentales,
              especiales o consecuentes derivados del uso o imposibilidad de uso
              de la plataforma.
            </li>
            <li>
              No nos hacemos responsables por pérdidas derivadas de
              interrupciones del servicio de WhatsApp Cloud API de Meta, cambios
              en las políticas de Meta, o suspensiones de cuentas de WhatsApp
              Business.
            </li>
            <li>
              La plataforma no genera ni valida contratos. Cualquier consecuencia
              legal de las transacciones inmobiliarias gestionadas a través de
              Inmox es responsabilidad de las partes de la transacción.
            </li>
            <li>
              No garantizamos la exactitud o integridad de la información
              introducida por los usuarios.
            </li>
          </ul>
        </section>

        {/* 8 */}
        <section aria-labelledby="t-sec-terminacion">
          <h2
            id="t-sec-terminacion"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            8. Terminación
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[#56565e]">
            <li>
              Puedes cancelar tu cuenta en cualquier momento contactándonos o
              mediante las opciones disponibles en la plataforma.
            </li>
            <li>
              Podemos suspender o cancelar cuentas que violen estos Términos,
              las políticas de Meta, o que supongan un riesgo de seguridad, con
              previo aviso salvo en casos de urgencia.
            </li>
            <li>
              Tras la terminación, tus datos se eliminarán conforme a lo
              establecido en la{" "}
              <a
                href="/privacidad"
                className="text-accent hover:underline"
              >
                Política de privacidad
              </a>
              .
            </li>
          </ul>
        </section>

        {/* 9 */}
        <section aria-labelledby="t-sec-modificaciones">
          <h2
            id="t-sec-modificaciones"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            9. Modificaciones a los Términos
          </h2>
          <p className="text-[#56565e]">
            Nos reservamos el derecho de modificar estos Términos. Notificaremos
            cambios materiales con al menos 15 días de anticipación por correo
            electrónico. El uso continuado de la plataforma tras la entrada en
            vigor de los cambios constituye la aceptación de los nuevos Términos.
          </p>
        </section>

        {/* 10 */}
        <section aria-labelledby="t-sec-ley">
          <h2
            id="t-sec-ley"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            10. Ley aplicable
          </h2>
          <p className="text-[#56565e]">
            Estos Términos se rigen por la legislación aplicable al lugar de
            operación del servicio. Cualquier disputa se resolverá conforme a
            dicha legislación y ante los tribunales competentes.
          </p>
        </section>

        {/* Contacto */}
        <section
          aria-labelledby="t-sec-contacto"
          className="rounded-lg border border-[#ccfbf1] bg-[#f0fdfa] px-6 py-5"
        >
          <h2
            id="t-sec-contacto"
            className="mb-2 text-base font-[650] text-[#115e59]"
          >
            Contacto
          </h2>
          <p className="text-sm text-[#56565e]">
            Para consultas sobre estos Términos:{" "}
            <a
              href="mailto:legal@inmox-dev.kevinbelier.cloud"
              className="text-accent hover:underline"
            >
              legal@inmox-dev.kevinbelier.cloud
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
