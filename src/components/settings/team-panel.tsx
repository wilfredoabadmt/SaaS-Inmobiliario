"use client";

import { useState } from "react";
import { Copy, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeamRole } from "@/lib/team/schemas";
import type { TeamMember } from "@/server/team/members";
import type { PendingInvitation } from "@/server/team/invitations";

interface TeamPanelProps {
  currentUserId: string;
  initialMembers: TeamMember[];
  initialInvitations: PendingInvitation[];
}

const ROLE_LABEL: Record<TeamRole, string> = { owner: "Dueño", agent: "Agente" };

/** Gestión de equipo (US4): lista de miembros (rol/eliminar), invitaciones + enlace copiable. */
export function TeamPanel({ currentUserId, initialMembers, initialInvitations }: TeamPanelProps) {
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("agent");
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  async function invite() {
    if (!email.trim() || inviting) return;
    setInviting(true);
    setMsg(null);
    setLastLink(null);
    try {
      const res = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            invitation?: PendingInvitation;
            acceptUrl?: string;
            emailSent?: boolean;
            error?: { message?: string };
          }
        | null;
      if (res.ok && data?.invitation) {
        setInvitations((prev) => [...prev, data.invitation!]);
        setEmail("");
        if (data.emailSent) {
          setMsg({ ok: true, text: `Invitación enviada a ${data.invitation.email}.` });
        } else {
          setMsg({
            ok: true,
            text: "Invitación creada. Comparte este enlace (no pudimos enviar el correo):",
          });
          setLastLink(data.acceptUrl ?? null);
        }
      } else {
        setMsg({ ok: false, text: data?.error?.message ?? "No se pudo invitar." });
      }
    } catch {
      setMsg({ ok: false, text: "Error de red. Inténtalo de nuevo." });
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(userId: string, nextRole: TeamRole) {
    const res = await fetch(`/api/team/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    if (res.ok) {
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: nextRole } : m)));
      setMsg(null);
    } else {
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setMsg({ ok: false, text: data?.error?.message ?? "No se pudo cambiar el rol." });
    }
  }

  async function remove(userId: string) {
    const res = await fetch(`/api/team/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      setMsg(null);
    } else {
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setMsg({ ok: false, text: data?.error?.message ?? "No se pudo eliminar." });
    }
  }

  async function cancelInvite(token: string) {
    const res = await fetch(`/api/team/invitations/${token}`, { method: "DELETE" });
    if (res.ok) setInvitations((prev) => prev.filter((i) => i.id !== token));
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    setMsg({ ok: true, text: "Enlace copiado al portapapeles." });
  }

  return (
    <div className="space-y-8">
      {/* Invitar */}
      <section className="rounded-lg border border-border bg-bg-panel p-5">
        <h2 className="flex items-center gap-2 text-[14px] font-[600] text-text">
          <Mail size={15} className="text-text-3" /> Invitar miembro
        </h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={inviting}
            className="sm:flex-1"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
            disabled={inviting}
            className="h-9 rounded-sm border border-border bg-bg px-3 text-sm text-text"
          >
            <option value="agent">Agente</option>
            <option value="owner">Dueño</option>
          </select>
          <Button type="button" onClick={invite} disabled={inviting || !email.trim()}>
            {inviting ? "Invitando…" : "Invitar"}
          </Button>
        </div>
        {msg && (
          <p className={msg.ok ? "mt-2 text-sm text-emerald-600" : "mt-2 text-sm text-red-600"}>
            {msg.text}
          </p>
        )}
        {lastLink && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-bg-sunken px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-[12px] text-text-2">{lastLink}</code>
            <button
              type="button"
              onClick={() => copy(lastLink)}
              className="inline-flex items-center gap-1 text-[12px] text-accent-text hover:underline"
            >
              <Copy size={13} /> Copiar
            </button>
          </div>
        )}
      </section>

      {/* Miembros */}
      <section>
        <h2 className="text-[14px] font-[600] text-text">Miembros ({members.length})</h2>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-bg-panel">
          {members.map((m) => {
            const isSelf = m.userId === currentUserId;
            return (
              <div key={m.userId} className="flex items-center gap-3 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-bg text-xs font-[650] text-text-2">
                  {(m.name || m.email).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-[600] text-text">
                    {m.name} {isSelf && <span className="text-text-4">(tú)</span>}
                  </div>
                  <div className="truncate text-[12px] text-text-3">{m.email}</div>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.userId, e.target.value as TeamRole)}
                  className="h-8 rounded-sm border border-border bg-bg px-2 text-[12.5px] text-text"
                  aria-label={`Rol de ${m.name}`}
                >
                  <option value="agent">{ROLE_LABEL.agent}</option>
                  <option value="owner">{ROLE_LABEL.owner}</option>
                </select>
                <button
                  type="button"
                  onClick={() => remove(m.userId)}
                  className="rounded-md p-1.5 text-text-4 hover:bg-bg-hover hover:text-red-600"
                  aria-label={`Eliminar a ${m.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Invitaciones pendientes */}
      {invitations.length > 0 && (
        <section>
          <h2 className="text-[14px] font-[600] text-text">
            Invitaciones pendientes ({invitations.length})
          </h2>
          <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-bg-panel">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-3">
                <Mail size={15} className="shrink-0 text-text-4" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-text-2">{inv.email}</div>
                  <div className="text-[11.5px] text-text-4">{ROLE_LABEL[inv.role]} · pendiente</div>
                </div>
                <button
                  type="button"
                  onClick={() => copy(`${window.location.origin}/accept-invitation/${inv.id}`)}
                  className="inline-flex items-center gap-1 text-[12px] text-accent-text hover:underline"
                >
                  <Copy size={13} /> Enlace
                </button>
                <button
                  type="button"
                  onClick={() => cancelInvite(inv.id)}
                  className="rounded-md p-1.5 text-text-4 hover:bg-bg-hover hover:text-red-600"
                  aria-label="Cancelar invitación"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
