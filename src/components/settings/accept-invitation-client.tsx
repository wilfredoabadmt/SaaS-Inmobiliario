"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AcceptInvitationClientProps {
  token: string;
  organizationName: string;
  invitedEmail: string;
  roleLabel: string;
  /** Email del usuario con sesión, o null si no hay sesión. */
  sessionEmail: string | null;
}

/**
 * Cliente de aceptación de invitación (US4). Tres caminos:
 *  - con sesión y email coincidente → aceptar directo;
 *  - con sesión y email distinto → pedir cambiar de cuenta;
 *  - sin sesión → alta **invite-aware** (crea SOLO la cuenta, sin agencia) o iniciar sesión,
 *    y luego acepta. Nunca llama a `organization.create` (DV-US-14).
 */
export function AcceptInvitationClient({
  token,
  organizationName,
  invitedEmail,
  roleLabel,
  sessionEmail,
}: AcceptInvitationClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const emailMatches = sessionEmail !== null && sessionEmail.toLowerCase() === invitedEmail.toLowerCase();

  async function doAccept() {
    const res = await fetch(`/api/team/invitations/${token}`, { method: "POST" });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; organizationId?: string; error?: { message?: string } }
      | null;
    if (res.ok && data?.organizationId) {
      await authClient.organization.setActive({ organizationId: data.organizationId });
      router.replace("/inbox");
      return;
    }
    setError(data?.error?.message ?? "No se pudo aceptar la invitación.");
    setBusy(false);
  }

  async function acceptWithSession() {
    setBusy(true);
    setError(null);
    try {
      await doAccept();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  async function registerAndAccept() {
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Crea SOLO la cuenta (sin agencia). Better Auth auto-inicia sesión.
      const signUp = await authClient.signUp.email({
        email: invitedEmail,
        password,
        name: name.trim(),
      });
      if (signUp.error) {
        const exists = /exist/i.test(signUp.error.message ?? "") || signUp.error.status === 422;
        setError(
          exists
            ? "Ese correo ya tiene cuenta. Inicia sesión para aceptar."
            : "No pudimos crear tu cuenta. Inténtalo de nuevo.",
        );
        if (exists) setMode("login");
        setBusy(false);
        return;
      }
      await doAccept();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  async function loginAndAccept() {
    setBusy(true);
    setError(null);
    try {
      const signIn = await authClient.signIn.email({ email: invitedEmail, password });
      if (signIn.error) {
        setError("Correo o contraseña incorrectos.");
        setBusy(false);
        return;
      }
      await doAccept();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  // --- Render ---
  const header = (
    <div className="text-center">
      <h1 className="text-[18px] font-[600] text-text">Unirte a {organizationName}</h1>
      <p className="mt-1 text-sm text-text-3">
        Te invitaron como <strong>{roleLabel}</strong> · {invitedEmail}
      </p>
    </div>
  );

  if (sessionEmail !== null && !emailMatches) {
    return (
      <div className="space-y-4">
        {header}
        <p className="rounded-md bg-bg-sunken px-3 py-2 text-sm text-text-2">
          Tienes la sesión iniciada como <strong>{sessionEmail}</strong>, pero esta invitación es
          para <strong>{invitedEmail}</strong>. Cierra sesión e inicia con ese correo.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await authClient.signOut();
            router.refresh();
          }}
        >
          Cerrar sesión
        </Button>
      </div>
    );
  }

  if (emailMatches) {
    return (
      <div className="space-y-4">
        {header}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="button" onClick={acceptWithSession} disabled={busy} className="w-full">
          {busy ? "Uniéndote…" : `Unirme a ${organizationName}`}
        </Button>
      </div>
    );
  }

  // Sin sesión → alta invite-aware o login.
  return (
    <div className="space-y-4">
      {header}
      <div className="flex gap-1 rounded-md bg-bg-sunken p-1 text-[13px]">
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded px-3 py-1.5 ${mode === "register" ? "bg-bg-panel font-[600] text-text shadow-rest" : "text-text-3"}`}
        >
          Crear cuenta
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded px-3 py-1.5 ${mode === "login" ? "bg-bg-panel font-[600] text-text shadow-rest" : "text-text-3"}`}
        >
          Ya tengo cuenta
        </button>
      </div>

      <div className="flex h-9 items-center rounded-sm border border-border bg-bg-sunken px-3 text-sm text-text-3">
        {invitedEmail}
      </div>

      {mode === "register" && (
        <Input
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          maxLength={100}
        />
      )}
      <Input
        type="password"
        placeholder="Contraseña"
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={busy}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="button"
        onClick={mode === "register" ? registerAndAccept : loginAndAccept}
        disabled={busy || !password}
        className="w-full"
      >
        {busy
          ? "Procesando…"
          : mode === "register"
            ? `Crear cuenta y unirme`
            : `Iniciar sesión y unirme`}
      </Button>
    </div>
  );
}
