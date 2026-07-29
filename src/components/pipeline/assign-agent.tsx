"use client";

import { useState } from "react";
import type { OrgMember } from "@/lib/pipeline/types";

/**
 * Selector de asignación de un trato a un miembro de la org (US5). "Sin asignar" = null.
 * Llama PATCH /api/pipeline/deals/[id] y notifica al padre para refrescar.
 */
export function AssignAgent({
  dealId,
  currentAgentId,
  members,
  onChanged,
}: {
  dealId: string;
  currentAgentId: string | null;
  members: OrgMember[];
  onChanged: () => void;
}) {
  const [value, setValue] = useState(currentAgentId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedAgentId: next || null }),
      });
      if (!res.ok) {
        setError(res.status === 400 ? "No es miembro de la organización" : "No se pudo asignar");
        setValue(currentAgentId ?? "");
      } else {
        onChanged();
      }
    } catch {
      setError("No se pudo asignar");
      setValue(currentAgentId ?? "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        value={value}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        className="w-full rounded-md border border-border bg-bg-panel px-2.5 py-1.5 text-[13px] text-text disabled:opacity-60"
      >
        <option value="">Sin asignar</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.role === "owner" ? " (dueño)" : ""}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-[12px] text-[color:var(--prop-cerr-text)]">{error}</p> : null}
    </div>
  );
}
