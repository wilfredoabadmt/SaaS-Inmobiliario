"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound } from "lucide-react";

/**
 * Conexión manual con token de System User (solo owner). El token se envía por
 * HTTPS al endpoint, que lo cifra; aquí nunca se guarda ni se muestra de vuelta.
 * phone_number_id / waba_id son opcionales: si se dejan vacíos, el servidor reusa
 * el número ya conectado.
 */
export function ManualConnectForm({ hasConnection }: { hasConnection: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit() {
    if (!token.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/whatsapp/connect/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          phoneNumberId: phoneNumberId.trim() || undefined,
          wabaId: wabaId.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { status?: string; displayPhoneNumber?: string | null; error?: { message?: string } }
        | null;
      if (res.ok) {
        setToken("");
        setResult({
          ok: true,
          message: `Conectado${data?.displayPhoneNumber ? ` · ${data.displayPhoneNumber}` : ""}.`,
        });
        router.refresh();
      } else {
        setResult({ ok: false, message: data?.error?.message ?? "No se pudo conectar." });
      }
    } catch {
      setResult({ ok: false, message: "Error de red. Inténtalo de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-bg-panel p-4">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-text-3" />
        <h2 className="text-[14px] font-[600] text-text">Conexión manual con token (System User)</h2>
      </div>
      <p className="mt-1 text-[12.5px] text-text-3">
        Pega un token permanente de System User para conectar o reconectar el número (p. ej. el
        número de prueba). {hasConnection ? "Deja vacíos phone_number_id y waba_id para reusar el número ya conectado." : "Indica phone_number_id y waba_id desde la API Setup de Meta."}
      </p>

      <div className="mt-3 space-y-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Token de System User (EAA…)"
          autoComplete="off"
          className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-sm text-text placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-tint"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder={hasConnection ? "phone_number_id (opcional)" : "phone_number_id"}
            className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-[13px] text-text placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-tint"
          />
          <input
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder={hasConnection ? "waba_id (opcional)" : "waba_id"}
            className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-[13px] text-text placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-tint"
          />
        </div>
      </div>

      {result && (
        <div
          className={
            "mt-2 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] " +
            (result.ok
              ? "bg-[color:var(--match-ok-bg)] text-[color:var(--match-ok-text)]"
              : "bg-[color:var(--match-no-bg)] text-[color:var(--match-no-text)]")
          }
        >
          {result.ok && <Check size={13} />}
          {result.message}
        </div>
      )}

      <button
        type="button"
        disabled={!token.trim() || busy}
        onClick={submit}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-[13px] font-[550] text-white transition-colors hover:bg-ink-hover disabled:opacity-50"
      >
        {busy ? "Conectando…" : "Conectar con token"}
      </button>
    </div>
  );
}
