import type { Metadata } from "next";
import { LegalNotice } from "@/components/public/legal-notice";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Eliminación de datos — Homya",
  description:
    "Cómo solicitar la eliminación de tus datos personales en Homya, conforme a los requisitos de Meta/WhatsApp.",
};

export default function EliminacionDeDatosPage() {
  return (
    <article className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <p className="mb-2 text-xs text-[#8c8c95]">Última actualización: 15 de junio de 2026</p>
        <h1 className="text-3xl font-[700] text-[#1a1a1e]">
          Solicitud de eliminación de datos
        </h1>
        <p className="mt-3 text-base text-[#56565e]">
          Esta página explica cómo los usuarios de <strong>Homya</strong> y sus
          clientes finales pueden solicitar la eliminación de sus datos
          personales de la plataforma, conforme a los requisitos de la{" "}
          <a
            href="https://developers.facebook.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Plataforma de Meta
          </a>{" "}
          para apps que usan la API de WhatsApp.
        </p>
      </header>

      <LegalNotice />

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-[#1a1a1e]">
        {/* Quién puede solicitar */}
        <section aria-labelledby="ed-sec-quien">
          <h2
            id="ed-sec-quien"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            1. ¿Quién puede solicitar la eliminación?
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[#56565e]">
            <li>
              <strong>Usuarios de la plataforma (agentes y dueños de agencia):</strong>{" "}
              cualquier persona con cuenta en Inmox puede solicitar la eliminación
              de su cuenta y de los datos asociados.
            </li>
            <li>
              <strong>Clientes finales (prospectos):</strong> personas cuyos
              datos fueron registrados en la plataforma por una agencia pueden
              solicitar la eliminación de sus datos contactándonos directamente.
            </li>
            <li>
              <strong>Usuarios de Facebook/Meta:</strong> si conectaste tu cuenta
              de Facebook o Meta a Inmox y deseas eliminar los datos que la
              plataforma obtuvo a través de esa conexión, puedes solicitarlo
              mediante los pasos descritos en esta página.
            </li>
          </ul>
        </section>

        {/* Cómo solicitar */}
        <section aria-labelledby="ed-sec-como">
          <h2
            id="ed-sec-como"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            2. Cómo solicitar la eliminación
          </h2>

          <div className="mb-6 rounded-lg border border-[#ccfbf1] bg-[#f0fdfa] px-6 py-5">
            <h3 className="mb-3 font-[650] text-[#115e59]">
              Opción A — Por correo electrónico (todos los usuarios)
            </h3>
            <ol className="list-decimal space-y-2 pl-6 text-[#56565e]">
              <li>
                Envía un correo a{" "}
                <a
                  href="mailto:privacidad@inmox-dev.kevinbelier.cloud"
                  className="text-accent hover:underline"
                >
                  privacidad@inmox-dev.kevinbelier.cloud
                </a>{" "}
                con el asunto: <strong>&ldquo;Solicitud de eliminación de datos&rdquo;</strong>.
              </li>
              <li>
                Incluye en el cuerpo del correo:
                <ul className="mt-2 list-disc space-y-1 pl-6 text-[#56565e]">
                  <li>Tu nombre completo.</li>
                  <li>El correo electrónico asociado a tu cuenta (si aplica).</li>
                  <li>Tu número de teléfono de WhatsApp (si aplica).</li>
                  <li>Una descripción breve de los datos que deseas eliminar.</li>
                </ul>
              </li>
              <li>
                Recibirás un acuse de recibo en un plazo de 5 días hábiles y la
                confirmación de eliminación en un plazo máximo de{" "}
                <strong>30 días hábiles</strong>.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-[#fce8c8] bg-[#fff8ed] px-6 py-5">
            <h3 className="mb-3 font-[650] text-[#9a5b00]">
              Opción B — Desde la configuración de tu cuenta (usuarios registrados)
            </h3>
            <p className="text-[#56565e]">
              Los usuarios con cuenta activa en Inmox pueden solicitar la
              eliminación de su cuenta directamente desde la sección de
              configuración de la plataforma (disponible en el panel de
              ajustes). Esta opción inicia el proceso de eliminación de manera
              inmediata y genera un registro de la solicitud.
            </p>
            <p className="mt-2 text-[#9a5b00]">
              Nota: esta función estará disponible en la versión de producción.
              Mientras tanto, utiliza la Opción A.
            </p>
          </div>
        </section>

        {/* Qué se elimina */}
        <section aria-labelledby="ed-sec-que">
          <h2
            id="ed-sec-que"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            3. ¿Qué datos se eliminan?
          </h2>
          <p className="mb-3 text-[#56565e]">
            Tras una solicitud de eliminación de cuenta de agencia, se procesan
            los siguientes datos:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#ececef] bg-[#f8f8f9]">
                  <th className="px-4 py-3 text-left font-[650] text-[#1a1a1e]">
                    Categoría de datos
                  </th>
                  <th className="px-4 py-3 text-left font-[650] text-[#1a1a1e]">
                    Acción
                  </th>
                  <th className="px-4 py-3 text-left font-[650] text-[#1a1a1e]">
                    Plazo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ececef] text-[#56565e]">
                <tr>
                  <td className="px-4 py-3">Cuenta de usuario (nombre, correo, contraseña)</td>
                  <td className="px-4 py-3">Eliminación permanente</td>
                  <td className="px-4 py-3">30 días hábiles</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Datos de la agencia (nombre, organización)</td>
                  <td className="px-4 py-3">Eliminación permanente</td>
                  <td className="px-4 py-3">30 días hábiles</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Token de acceso de WhatsApp (cifrado)</td>
                  <td className="px-4 py-3">Eliminación permanente</td>
                  <td className="px-4 py-3">Inmediato al procesar</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Datos de clientes finales (números, mensajes, candidaturas)</td>
                  <td className="px-4 py-3">Eliminación o anonimización</td>
                  <td className="px-4 py-3">30 días hábiles</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Propiedades registradas y archivos adjuntos</td>
                  <td className="px-4 py-3">Eliminación del almacenamiento de objetos y base de datos</td>
                  <td className="px-4 py-3">30 días hábiles</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Registros técnicos de operación</td>
                  <td className="px-4 py-3">Eliminación automática por rotación</td>
                  <td className="px-4 py-3">90 días (por política de retención)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[#8c8c95]">
            Excepción: conservaremos el mínimo de datos requerido por obligación
            legal o para la resolución de disputas pendientes, durante el tiempo
            estrictamente necesario.
          </p>
        </section>

        {/* Clientes finales */}
        <section aria-labelledby="ed-sec-clientes">
          <h2
            id="ed-sec-clientes"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            4. Eliminación de datos de clientes finales
          </h2>
          <p className="text-[#56565e]">
            Si eres un cliente (prospecto o arrendatario) cuyos datos fueron
            registrados por una agencia que usa Inmox y deseas que eliminemos tu
            información, contáctanos en{" "}
            <a
              href="mailto:privacidad@inmox-dev.kevinbelier.cloud"
              className="text-accent hover:underline"
            >
              privacidad@inmox-dev.kevinbelier.cloud
            </a>{" "}
            indicando tu número de teléfono de WhatsApp y el nombre de la
            agencia. Procesaremos tu solicitud en un plazo de 30 días hábiles.
          </p>
        </section>

        {/* Data Deletion Callback */}
        <section aria-labelledby="ed-sec-callback">
          <h2
            id="ed-sec-callback"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            5. Endpoint de eliminación de datos (para Meta / administradores)
          </h2>
          <p className="mb-3 text-[#56565e]">
            Para facilitar la integración con los flujos automatizados de Meta,
            esta página actúa como la <strong>Data Deletion Instructions URL</strong>{" "}
            requerida por la Plataforma de Meta. En el panel de Meta Developers
            también existe la opción de configurar un{" "}
            <strong>Data Deletion Callback URL</strong> que acepta solicitudes
            POST automáticas de Meta cuando un usuario revoca permisos desde
            Facebook.
          </p>
          <div className="rounded-lg border border-[#ececef] bg-[#f8f8f9] px-5 py-4">
            <p className="mb-2 text-xs font-[650] text-[#56565e]">
              INFORMACIÓN PARA CONFIGURACIÓN EN META DEVELOPERS
            </p>
            <p className="mb-1 text-xs text-[#56565e]">
              <strong>Data Deletion Instructions URL (activa):</strong>
            </p>
            <code className="block rounded bg-[#f0fdfa] px-3 py-2 text-xs text-[#115e59]">
              https://inmox-dev.kevinbelier.cloud/eliminacion-de-datos
            </code>
            <p className="mt-3 mb-1 text-xs text-[#56565e]">
              <strong>Data Deletion Callback URL (opcional — endpoint automático):</strong>
            </p>
            <code className="block rounded bg-[#f8f8f9] px-3 py-2 text-xs text-[#56565e]">
              https://inmox-dev.kevinbelier.cloud/api/data-deletion-callback
            </code>
            <p className="mt-2 text-xs text-[#8c8c95]">
              Nota: El endpoint del callback requiere implementación adicional.
              Por ahora, la URL de instrucciones (esta página) cumple el
              requisito de Meta. Consulta la documentación de Meta para el
              formato de solicitud del callback.
            </p>
          </div>
        </section>

        {/* Confirmación */}
        <section aria-labelledby="ed-sec-confirmacion">
          <h2
            id="ed-sec-confirmacion"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            6. Confirmación de eliminación
          </h2>
          <p className="text-[#56565e]">
            Una vez completado el proceso de eliminación, recibirás una
            confirmación por correo electrónico con un código de referencia de
            la solicitud. Si no recibes confirmación en el plazo indicado,
            contáctanos nuevamente con el número de referencia de tu solicitud.
          </p>
        </section>

        {/* Contacto */}
        <section
          aria-labelledby="ed-sec-contacto"
          className="rounded-lg border border-[#ccfbf1] bg-[#f0fdfa] px-6 py-5"
        >
          <h2
            id="ed-sec-contacto"
            className="mb-2 text-base font-[650] text-[#115e59]"
          >
            Contacto para solicitudes de eliminación
          </h2>
          <p className="text-sm text-[#56565e]">
            Correo:{" "}
            <a
              href="mailto:privacidad@inmox-dev.kevinbelier.cloud"
              className="text-accent hover:underline"
            >
              privacidad@inmox-dev.kevinbelier.cloud
            </a>
          </p>
          <p className="mt-1 text-sm text-[#56565e]">
            Asunto recomendado:{" "}
            <em>&ldquo;Solicitud de eliminación de datos — [tu nombre]&rdquo;</em>
          </p>
        </section>
      </div>
    </article>
  );
}
