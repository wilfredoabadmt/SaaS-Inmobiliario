import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/guards";
import { getProfile } from "@/server/account/profile";
import { ProfileForm } from "@/components/settings/profile-form";
import { SettingsShell } from "@/components/settings/settings-shell";

export const dynamic = "force-dynamic";

/** Perfil personal (US1). Disponible para todo miembro. */
export default async function AccountSettingsPage() {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");

  const profile = await getProfile(ctx.userId);
  if (!profile) redirect("/login");

  const roleLabel = ctx.role === "owner" ? "Dueño" : "Agente";

  return (
    <SettingsShell title="Perfil" description="Tu nombre y foto de perfil.">
      <ProfileForm
        initialName={profile.name}
        email={profile.email}
        roleLabel={roleLabel}
        initialAvatarUrl={profile.avatarUrl}
      />
    </SettingsShell>
  );
}
