"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Cambio de contraseña (US2) vía Better Auth (`changePassword`). Exige la contraseña actual;
 * `revokeOtherSessions:true` cierra las demás sesiones. Errores legibles (actual incorrecta).
 */
export function SecurityForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    if (next.length < 8) {
      setMsg({ ok: false, text: "La nueva contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: "Las contraseñas nuevas no coinciden." });
      return;
    }
    setBusy(true);
    try {
      const res = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) {
        const code = (res.error.code ?? "").toUpperCase();
        const wrong = res.error.status === 400 || code.includes("PASSWORD") || code.includes("INVALID");
        setMsg({
          ok: false,
          text: wrong
            ? "La contraseña actual no es correcta."
            : "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
        });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg({ ok: true, text: "Contraseña actualizada." });
    } catch {
      setMsg({ ok: false, text: "Error de red. Inténtalo de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-bg-panel p-5">
      <h2 className="text-[14px] font-[600] text-text">Cambiar contraseña</h2>
      <Field label="Contraseña actual" value={current} onChange={setCurrent} disabled={busy} />
      <Field label="Nueva contraseña" value={next} onChange={setNext} disabled={busy} />
      <Field
        label="Confirmar nueva contraseña"
        value={confirm}
        onChange={setConfirm}
        disabled={busy}
      />
      {msg && (
        <p className={msg.ok ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{msg.text}</p>
      )}
      <Button
        type="button"
        onClick={submit}
        disabled={busy || !current || !next || !confirm}
      >
        {busy ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text-2">{label}</label>
      <Input
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
