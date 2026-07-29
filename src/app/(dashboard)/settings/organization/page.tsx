import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/guards";
import { getOrganization } from "@/server/organization/settings";
import { OrganizationForm } from "@/components/settings/organization-form";
import { SettingsShell } from "@/components/settings/settings-shell";

export const dynamic = "force-dynamic";

/** Datos de la agencia (US3). Solo owner. */
export default async function OrganizationSettingsPage() {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner") {
    return (
      <SettingsShell title="Organización">
        <p className="text-sm text-text-3">
          Solo el dueño de la agencia puede editar estos datos.
        </p>
      </SettingsShell>
    );
  }

  const org = await getOrganization(ctx.organizationId);
  if (!org) redirect("/settings");

  return (
    <SettingsShell title="Organización" description="Nombre y logo de tu agencia.">
      <OrganizationForm initialName={org.name} initialLogoUrl={org.logoUrl} />
    </SettingsShell>
  );
}
