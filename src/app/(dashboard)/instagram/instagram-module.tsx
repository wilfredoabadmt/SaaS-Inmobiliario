"use client";

import { useState } from "react";
import type { PropertyOption } from "@/components/instagram/property-picker";
import { Composer } from "./composer";
import { CommentsPanel } from "./comments-panel";
import { DmPanel } from "./dm-panel";

type Tab = "publish" | "comments" | "dms";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "publish", label: "Publicar" },
  { key: "comments", label: "Comentarios" },
  { key: "dms", label: "Mensajes" },
];

/** Shell del módulo de Instagram con pestañas (feature 008, aislado de la bandeja). */
export function InstagramModule({
  properties,
  igUserId,
}: {
  properties: PropertyOption[];
  igUserId: string;
}) {
  const [tab, setTab] = useState<Tab>("publish");

  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              "px-3 py-2 text-[13px] font-[550] transition-colors " +
              (tab === t.key
                ? "border-b-2 border-accent text-text"
                : "text-text-3 hover:text-text-2")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "publish" && <Composer properties={properties} />}
        {tab === "comments" && <CommentsPanel />}
        {tab === "dms" && <DmPanel igUserId={igUserId} />}
      </div>
    </div>
  );
}
