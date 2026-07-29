import { requireMember } from "@/lib/auth/guards";
import { TYPO } from "@/lib/design/typography";
import { TemplatesClient } from "@/components/templates/templates-client";
import { getConnectionStatus } from "@/server/whatsapp/credentials";
import { listTemplatesWithStatus } from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

/** Sección de plantillas de WhatsApp: administración real contra Meta (feature 012). */
export default async function TemplatesPage() {
  const { organizationId, role } = await requireMember();
  const [templates, conn] = await Promise.all([
    listTemplatesWithStatus(organizationId),
    getConnectionStatus(organizationId),
  ]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[920px] px-8 py-8">
        <h1 className={TYPO.h1}>Plantillas</h1>
        <p className="mt-1 text-[13px] text-text-3">
          Crea y administra tus plantillas de WhatsApp. Las plantillas aprobadas te dejan escribir a un
          cliente cuando la ventana de 24 h ya cerró.
        </p>
        <TemplatesClient
          initialTemplates={templates}
          canManage={role === "owner"}
          connected={conn.status === "connected"}
        />
      </div>
    </div>
  );
}
