import type { Metadata } from "next";
import { LegalNotice } from "@/components/public/legal-notice";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Política de privacidad — Homya",
  description:
    "Cómo Homya recolecta, usa y protege los datos personales de sus usuarios y sus clientes finales.",
};

export default function PrivacidadPage() {
  return (
    <article className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <p className="mb-2 text-xs text-[#8c8c95]">Última actualización: 15 de junio de 2026</p>
        <h1 className="text-3xl font-[700] text-[#1a1a1e]">
          Política de privacidad
        </h1>
        <p className="mt-3 text-base text-[#56565e]">
          Esta política describe cómo <strong>Homya</strong> (en adelante
          &ldquo;la plataforma&rdquo;, &ldquo;nosotros&rdquo;) recolecta, usa,
          almacena y protege los datos personales de los usuarios de la
          plataforma (agentes y agencias inmobiliarias) y de sus clientes
          finales (personas que contactan a través de WhatsApp).
        </p>
      </header>

      <LegalNotice />

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-[#1a1a1e]">
        {/* 1 */}
        <section aria-labelledby="sec-responsable">
          <h2
            id="sec-responsable"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            1. Responsable del tratamiento
          </h2>
          <p className="text-[#56565e]">
            El responsable del tratamiento de datos personales es el operador de
            la plataforma Inmox. Para cualquier consulta relacionada con tus
            datos, contáctanos en:{" "}
            <a
              href="mailto:privacidad@inmox-dev.kevinbelier.cloud"
              className="text-accent hover:underline"
            >
              privacidad@inmox-dev.kevinbelier.cloud
            </a>
            .
          </p>
        </section>

        {/* 2 */}
        <section aria-labelledby="sec-datos">
          <h2
            id="sec-datos"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            2. Datos que recolectamos
          </h2>
          <p className="mb-3 text-[#56565e]">
            La plataforma recolecta y procesa las siguientes categorías de
            datos, dependiendo del rol del usuario:
          </p>

          <h3 className="mb-2 font-[650] text-[#1a1a1e]">
            2.1 Datos de la cuenta del agente o agencia
          </h3>
          <ul className="mb-4 list-disc space-y-1 pl-6 text-[#56565e]">
            <li>Nombre completo y dirección de correo electrónico.</li>
            <li>Contraseña (almacenada con hash bcrypt; nunca en texto plano).</li>
            <li>Nombre y datos de la agencia inmobiliaria.</li>
            <li>Rol dentro de la agencia (dueño o agente).</li>
            <li>
              Credenciales de WhatsApp Business API (número de teléfono,
              identificador de cuenta de WhatsApp Business —WABA ID—, token de
              acceso de Meta). El token de acceso se almacena cifrado con
              AES-256-GCM y <strong>nunca</strong> se transmite al navegador ni
              aparece en registros de sistema.
            </li>
          </ul>

          <h3 className="mb-2 font-[650] text-[#1a1a1e]">
            2.2 Datos de clientes finales (prospectos y arrendatarios)
          </h3>
          <ul className="mb-4 list-disc space-y-1 pl-6 text-[#56565e]">
            <li>Número de teléfono de WhatsApp.</li>
            <li>Nombre y datos de contacto (si el agente los registra manualmente o si el cliente los comparte en conversación).</li>
            <li>Historial de mensajes de WhatsApp entre el cliente y la agencia.</li>
            <li>
              Datos de candidatura: propiedades de interés (renta o venta),
              estado del proceso, notas del agente, fechas de contacto y
              muestras.
            </li>
          </ul>

          <h3 className="mb-2 font-[650] text-[#1a1a1e]">
            2.3 Datos de propiedades
          </h3>
          <ul className="mb-4 list-disc space-y-1 pl-6 text-[#56565e]">
            <li>Dirección, precio, tipo de operación (renta / venta), estado y características.</li>
            <li>Archivos adjuntos (fotos, documentos). Se almacenan en un servicio de objetos S3-compatible; los archivos de documentos se rastrean en cuanto a su estado, pero su contenido no es analizado por la plataforma.</li>
          </ul>

          <h3 className="mb-2 font-[650] text-[#1a1a1e]">
            2.4 Datos técnicos y de uso
          </h3>
          <ul className="list-disc space-y-1 pl-6 text-[#56565e]">
            <li>Registros de solicitudes a la API (timestamps, rutas, códigos de respuesta) con fines operacionales. No contienen contenido de mensajes.</li>
            <li>Identificadores internos de sesión (cookies de autenticación).</li>
          </ul>
        </section>

        {/* 3 */}
        <section aria-labelledby="sec-finalidades">
          <h2
            id="sec-finalidades"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            3. Finalidades del tratamiento y base legal
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#ececef] bg-[#f8f8f9]">
                  <th className="px-4 py-3 text-left font-[650] text-[#1a1a1e]">
                    Finalidad
                  </th>
                  <th className="px-4 py-3 text-left font-[650] text-[#1a1a1e]">
                    Base legal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ececef] text-[#56565e]">
                <tr>
                  <td className="px-4 py-3">Prestación del servicio CRM (bandeja, pipeline, plantillas)</td>
                  <td className="px-4 py-3">Ejecución del contrato de servicio</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Integración con WhatsApp Cloud API de Meta</td>
                  <td className="px-4 py-3">Ejecución del contrato; interés legítimo</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Autenticación y seguridad de la cuenta</td>
                  <td className="px-4 py-3">Ejecución del contrato; interés legítimo</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Almacenamiento de archivos adjuntos (documentos, fotos)</td>
                  <td className="px-4 py-3">Ejecución del contrato</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Registros de operación y diagnóstico técnico</td>
                  <td className="px-4 py-3">Interés legítimo (seguridad y continuidad)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4 */}
        <section aria-labelledby="sec-terceros">
          <h2
            id="sec-terceros"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            4. Terceros encargados del tratamiento
          </h2>
          <p className="mb-3 text-[#56565e]">
            Inmox utiliza los siguientes proveedores externos que actúan como
            encargados del tratamiento:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[#56565e]">
            <li>
              <strong className="text-[#1a1a1e]">Meta Platforms, Inc. (WhatsApp Cloud API):</strong>{" "}
              El envío y recepción de mensajes de WhatsApp se realiza a través
              de la API oficial de Meta. Los mensajes transitan por la
              infraestructura de Meta según sus propias políticas de privacidad
              y los{" "}
              <a
                href="https://developers.facebook.com/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Términos de la Plataforma de Meta
              </a>
              .
            </li>
            <li>
              <strong className="text-[#1a1a1e]">Almacenamiento de objetos S3-compatible (Cloudflare R2 / MinIO):</strong>{" "}
              Los archivos adjuntos (fotos de propiedades, documentos de
              candidaturas) se almacenan en un servicio de objetos compatible
              con el estándar S3. El proveedor específico depende de la
              configuración del despliegue y puede ser R2 de Cloudflare o un
              servidor MinIO auto-hospedado.
            </li>
            <li>
              <strong className="text-[#1a1a1e]">Infraestructura de hosting (VPS auto-hospedado, Coolify):</strong>{" "}
              La base de datos PostgreSQL y la aplicación Next.js se alojan en
              un servidor privado virtual (VPS) administrado por el operador,
              utilizando Coolify como plataforma de despliegue. Los datos no se
              replican a nubes públicas de terceros salvo el almacenamiento de
              objetos mencionado.
            </li>
          </ul>
        </section>

        {/* 5 */}
        <section aria-labelledby="sec-conservacion">
          <h2
            id="sec-conservacion"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            5. Conservación de los datos
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[#56565e]">
            <li>
              Los datos de cuenta y los datos operacionales se conservan
              mientras la agencia mantenga activa su cuenta en la plataforma.
            </li>
            <li>
              Tras la solicitud de eliminación de cuenta, los datos se eliminan
              o anonimizan en un plazo máximo de <strong>30 días hábiles</strong>, salvo
              obligación legal de conservación aplicable.
            </li>
            <li>
              Los registros técnicos de operación se conservan por un período
              máximo de <strong>90 días</strong> con fines de diagnóstico y
              seguridad.
            </li>
          </ul>
        </section>

        {/* 6 */}
        <section aria-labelledby="sec-transferencias">
          <h2
            id="sec-transferencias"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            6. Transferencias internacionales
          </h2>
          <p className="text-[#56565e]">
            Los mensajes de WhatsApp transitan por los servidores de Meta
            Platforms, Inc. (Estados Unidos) de conformidad con las políticas de
            transferencia internacional de Meta. No realizamos otras
            transferencias internacionales de datos fuera del alcance descrito
            en la sección 4.
          </p>
        </section>

        {/* 7 */}
        <section aria-labelledby="sec-derechos">
          <h2
            id="sec-derechos"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            7. Derechos del titular de los datos
          </h2>
          <p className="mb-3 text-[#56565e]">
            Tienes derecho a ejercer los siguientes derechos respecto de tus
            datos personales:
          </p>
          <ul className="mb-4 list-disc space-y-1 pl-6 text-[#56565e]">
            <li><strong>Acceso:</strong> conocer qué datos tenemos sobre ti.</li>
            <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
            <li><strong>Eliminación:</strong> solicitar la supresión de tus datos (ver <a href="/eliminacion-de-datos" className="text-accent hover:underline">página de eliminación de datos</a>).</li>
            <li><strong>Oposición y limitación:</strong> en los casos previstos por la normativa aplicable.</li>
            <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común.</li>
          </ul>
          <p className="text-[#56565e]">
            Para ejercer cualquiera de estos derechos, envía un correo a{" "}
            <a
              href="mailto:privacidad@inmox-dev.kevinbelier.cloud"
              className="text-accent hover:underline"
            >
              privacidad@inmox-dev.kevinbelier.cloud
            </a>{" "}
            indicando tu nombre, correo de cuenta y el derecho que deseas
            ejercer. Responderemos en un plazo máximo de 20 días hábiles.
          </p>
        </section>

        {/* 8 */}
        <section aria-labelledby="sec-seguridad">
          <h2
            id="sec-seguridad"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            8. Seguridad
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[#56565e]">
            <li>Las comunicaciones con la plataforma se realizan exclusivamente por HTTPS/TLS.</li>
            <li>Los tokens de acceso de WhatsApp se cifran en reposo con AES-256-GCM y no son accesibles desde el lado del cliente ni aparecen en registros de sistema.</li>
            <li>El acceso multi-tenant garantiza que cada agencia solo puede ver sus propios datos mediante un identificador de organización presente en todas las consultas de base de datos.</li>
            <li>Las contraseñas de los usuarios se almacenan con hash bcrypt.</li>
          </ul>
        </section>

        {/* 9 */}
        <section aria-labelledby="sec-menores">
          <h2
            id="sec-menores"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            9. Menores de edad
          </h2>
          <p className="text-[#56565e]">
            La plataforma está dirigida exclusivamente a profesionales
            inmobiliarios. No recolectamos intencionalmente datos de personas
            menores de 18 años.
          </p>
        </section>

        {/* 10 */}
        <section aria-labelledby="sec-cambios">
          <h2
            id="sec-cambios"
            className="mb-3 text-xl font-[650] text-[#1a1a1e]"
          >
            10. Cambios a esta política
          </h2>
          <p className="text-[#56565e]">
            Podremos actualizar esta política periódicamente. Notificaremos
            cambios materiales por correo electrónico o mediante aviso visible
            en la plataforma antes de que entren en vigor.
          </p>
        </section>

        {/* Contacto */}
        <section
          aria-labelledby="sec-contacto"
          className="rounded-lg border border-[#ccfbf1] bg-[#f0fdfa] px-6 py-5"
        >
          <h2
            id="sec-contacto"
            className="mb-2 text-base font-[650] text-[#115e59]"
          >
            Contacto
          </h2>
          <p className="text-sm text-[#56565e]">
            Para cualquier consulta sobre privacidad o para ejercer tus
            derechos:{" "}
            <a
              href="mailto:privacidad@inmox-dev.kevinbelier.cloud"
              className="text-accent hover:underline"
            >
              privacidad@inmox-dev.kevinbelier.cloud
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
