import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { previewInvitation } from "@/server/team/invitations";
import { AcceptInvitationClient } from "@/components/settings/accept-invitation-client";

export const dynamic = "force-dynamic";

const STATE_MESSAGE: Record<string, string> = {
  invalid: "Esta invitación no es válida.",
  expired: "Esta invitación expiró. Pide una nueva al dueño de la agencia.",
  already_used: "Esta invitación ya fue usada o cancelada.",
};

/**
 * Aceptación de invitación (US4, fuera de `(dashboard)`). Lee el estado de la invitación y
 * la sesión actual; delega la interacción al cliente (alta invite-aware o aceptar).
 */
export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await previewInvitation(token);
  const session = await auth.api.getSession({ headers: await headers() });
  const sessionEmail = session?.user?.email ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-panel p-6 shadow-rest">
        {preview.state !== "ok" ? (
          <div className="text-center">
            <h1 className="text-[18px] font-[600] text-text">Invitación no disponible</h1>
            <p className="mt-2 text-sm text-text-3">{STATE_MESSAGE[preview.state]}</p>
          </div>
        ) : (
          <AcceptInvitationClient
            token={token}
            organizationName={preview.organizationName}
            invitedEmail={preview.email}
            roleLabel={preview.role === "owner" ? "dueño" : "agente"}
            sessionEmail={sessionEmail}
          />
        )}
      </div>
    </main>
  );
}
