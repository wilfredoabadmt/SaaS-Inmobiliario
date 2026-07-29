import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/guards";
import { listMembers } from "@/server/team/members";
import { listInvitations } from "@/server/team/invitations";
import { TeamPanel } from "@/components/settings/team-panel";
import { SettingsShell } from "@/components/settings/settings-shell";

export const dynamic = "force-dynamic";

/** Equipo (US4). Solo owner. */
export default async function TeamSettingsPage() {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner") {
    return (
      <SettingsShell title="Equipo">
        <p className="text-sm text-text-3">
          Solo el dueño de la agencia puede administrar el equipo.
        </p>
      </SettingsShell>
    );
  }

  const [members, invitations] = await Promise.all([
    listMembers(ctx.organizationId),
    listInvitations(ctx.organizationId),
  ]);

  return (
    <SettingsShell title="Equipo" description="Invita miembros y administra sus roles.">
      <TeamPanel
        currentUserId={ctx.userId}
        initialMembers={members}
        initialInvitations={invitations}
      />
    </SettingsShell>
  );
}
