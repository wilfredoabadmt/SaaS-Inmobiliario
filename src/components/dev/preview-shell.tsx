"use client";

import Image from "next/image";
import Link from "next/link";
import { SidebarNav, SettingsRailButton } from "@/components/layout/sidebar-nav";

/**
 * Shell de preview dev-only: replica el riel de 66px del layout real sin requerir
 * auth/DB, para verificar visualmente cualquier vista con fixtures. NO se sirve en
 * producción (las páginas que lo usan están gated por NODE_ENV).
 */
export function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <aside className="flex w-[66px] shrink-0 flex-col items-center border-r border-border bg-bg-sunken py-3">
        <Link
          href="/dev-preview/inicio"
          className="mb-4 flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-[10px] shadow-rest"
        >
          <Image
            src="/inmox-logo.png"
            alt="Inmox"
            width={38}
            height={38}
            className="h-full w-full object-cover"
          />
        </Link>
        <SidebarNav />
        <div className="mt-auto flex flex-col items-center gap-2">
          <SettingsRailButton />
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-bg-panel text-xs font-[650] text-text-2">
            D
          </span>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden bg-bg">{children}</main>
    </div>
  );
}
