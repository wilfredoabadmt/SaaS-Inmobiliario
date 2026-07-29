import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/guards";
import { SecurityForm } from "@/components/settings/security-form";
import { LogoutButton } from "@/components/settings/logout-button";
import { SettingsShell } from "@/components/settings/settings-shell";

export const dynamic = "force-dynamic";

/** Seguridad (US2): cambiar contraseña + cerrar sesión. Todo miembro. */
export default async function SecuritySettingsPage() {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");

  return (
    <SettingsShell title="Seguridad" description="Cambia tu contraseña y cierra sesión.">
      <SecurityForm />
      <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-bg-panel p-5">
        <div>
          <div className="text-[14px] font-[600] text-text">Sesión</div>
          <div className="text-[12.5px] text-text-3">Cierra tu sesión en este dispositivo.</div>
        </div>
        <LogoutButton />
      </div>
    </SettingsShell>
  );
}
