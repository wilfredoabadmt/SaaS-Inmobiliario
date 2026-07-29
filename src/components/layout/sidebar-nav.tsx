"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Columns3,
  FileText,
  Home,
  Instagram,
  LayoutGrid,
  MessageCircle,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Punto verde de WhatsApp conectado (Bandeja). */
  online?: boolean;
}

const NAV: readonly NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: LayoutGrid },
  { href: "/inbox", label: "Bandeja", icon: MessageCircle, online: true },
  { href: "/properties", label: "Propiedades", icon: Home },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/showings", label: "Visitas", icon: Calendar },
  { href: "/templates", label: "Plantillas", icon: FileText },
  { href: "/instagram", label: "Instagram", icon: Instagram },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Botón del riel: 44×44, ícono + tooltip, estado activo del handoff. */
function RailButton({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const { icon: Icon } = item;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 w-11 items-center justify-center rounded-rail transition-colors",
        active
          ? "border border-border-strong bg-bg-panel text-text shadow-[0_1px_2px_rgba(0,0,0,0.07)]"
          : "border border-transparent text-[#98938a] hover:bg-bg-hover hover:text-text-2",
      )}
    >
      <Icon size={19} strokeWidth={1.8} />
      {item.online && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-bg-sunken bg-status-online animate-pulse-dot" />
      )}
      {/* Tooltip */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full ml-2 z-20 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-[550] text-white opacity-0 shadow-lift transition-opacity group-hover:opacity-100"
      >
        {item.label}
      </span>
    </Link>
  );
}

/** Navegación principal del riel (las 6 vistas de trabajo). */
export function SidebarNav() {
  return (
    <nav className="flex flex-col items-center gap-1.5">
      {NAV.map((item) => (
        <RailButton key={item.href} item={item} />
      ))}
    </nav>
  );
}

/** Botón de Configuración (anclado abajo en el riel). */
export function SettingsRailButton() {
  return <RailButton item={{ href: "/settings", label: "Configuración", icon: Settings }} />;
}

export { RailButton, type NavItem };
