import Link from "next/link";
import {
  Building2,
  Instagram,
  MessageCircle,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getActiveContext } from "@/lib/auth/guards";
import { TYPO } from "@/lib/design/typography";

export const dynamic = "force-dynamic";

interface SettingsCard {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
}

const CARDS: readonly SettingsCard[] = [
  {
    href: "/settings/account",
    title: "Perfil",
    description: "Tu nombre y foto de perfil.",
    icon: UserCircle,
  },
  {
    href: "/settings/security",
    title: "Seguridad",
    description: "Cambia tu contraseña y cierra sesión.",
    icon: ShieldCheck,
  },
  {
    href: "/settings/organization",
    title: "Organización",
    description: "Nombre y logo de tu agencia.",
    icon: Building2,
    ownerOnly: true,
  },
  {
    href: "/settings/team",
    title: "Equipo",
    description: "Invita miembros y administra sus roles.",
    icon: Users,
    ownerOnly: true,
  },
  {
    href: "/settings/whatsapp",
    title: "WhatsApp",
    description: "Conecta y administra tu número de WhatsApp.",
    icon: MessageCircle,
    ownerOnly: true,
  },
  {
    href: "/settings/instagram",
    title: "Instagram",
    description: "Conecta tu cuenta para publicar, moderar y mensajear.",
    icon: Instagram,
    ownerOnly: true,
  },
];

/**
 * Índice de Configuración (feature 013). Tarjetas a cada sección; las de owner
 * (organización, equipo, WhatsApp, Instagram) se ocultan para los agentes.
 */
export default async function SettingsPage() {
  const ctx = await getActiveContext();
  const isOwner = ctx?.role === "owner";
  const cards = CARDS.filter((c) => !c.ownerOnly || isOwner);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-8 py-8">
        <div className="flex items-center gap-2.5">
          <Settings size={20} className="text-text-3" />
          <h1 className={TYPO.h1}>Configuración</h1>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel p-4 shadow-rest transition-shadow hover:shadow-lift"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-tint text-accent-text">
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-[600] text-text">{card.title}</div>
                  <div className="text-[12px] text-text-3">{card.description}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
