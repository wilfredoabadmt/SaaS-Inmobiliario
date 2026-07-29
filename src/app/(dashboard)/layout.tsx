import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/guards";
import { getProfile } from "@/server/account/profile";
import { SidebarNav, SettingsRailButton } from "@/components/layout/sidebar-nav";

/** Shell del dashboard: riel de iconos de 66px + área de contenido. Ruta protegida. */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");

  const roleLabel = ctx.role === "owner" ? "Dueño" : "Agente";
  // Lee la fila `user` directa (name/image) para el avatar del riel (DV-US-15).
  const profile = await getProfile(ctx.userId);
  const avatarUrl = profile?.avatarUrl ?? null;
  const initial = (profile?.name || roleLabel).charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <aside className="flex w-[66px] shrink-0 flex-col items-center border-r border-border bg-bg-sunken py-3">
        {/* Logo de marca */}
        <Link
          href="/inicio"
          aria-label="Homya — Inicio"
          className="mb-4 flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-[10px] shadow-rest"
        >
          <Image
            src="/homya-logo.png"
            alt="Homya"
            width={38}
            height={38}
            className="h-full w-full object-cover"
            priority
          />
        </Link>

        <SidebarNav />

        {/* Anclados abajo: configuración + avatar de usuario */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <SettingsRailButton />
          <Link
            href="/settings/account"
            title={`${profile?.name ?? roleLabel} · ${roleLabel}`}
            aria-label="Tu perfil"
            className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-bg-panel text-xs font-[650] text-text-2"
          >
            {avatarUrl ? (
              // URL prefirmada de R2 (host dinámico); next/image exigiría whitelistear el host.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden bg-bg">{children}</main>
    </div>
  );
}
