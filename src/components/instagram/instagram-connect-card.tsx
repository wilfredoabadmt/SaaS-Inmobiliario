"use client";

import { useState } from "react";
import { Instagram } from "lucide-react";

type IgStatus = "connected" | "disconnected" | "expired" | "reconnect_required" | "none";

const STATUS_LABEL: Record<IgStatus, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  expired: "Token expirado",
  reconnect_required: "Reconectar",
  none: "Sin conectar",
};

interface Props {
  status: IgStatus;
  username: string | null;
  tokenExpiresAt: string | null;
  disabled?: boolean;
}

/** Tarjeta de conexión de Instagram (espejo de la de WhatsApp). FR-007. */
export function InstagramConnectCard({ status, username, tokenExpiresAt, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const connected = status === "connected";
  const needsReconnect = status === "expired" || status === "reconnect_required";

  function connect() {
    window.location.href = "/api/instagram/connect";
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/instagram/disconnect", { method: "POST" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-panel p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-tint text-accent-text">
          <Instagram size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-[600] text-text">Instagram</div>
          <div className="text-[12px] text-text-3">
            {connected || needsReconnect
              ? `@${username ?? ""} · ${STATUS_LABEL[status]}`
              : "Conecta tu cuenta de Instagram"}
          </div>
        </div>
      </div>

      {(connected || needsReconnect) && tokenExpiresAt && (
        <div className="mt-2 text-[12px] text-text-3">
          El token expira el {new Date(tokenExpiresAt).toLocaleDateString("es-MX")}.
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {connected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy || disabled}
            className="rounded-md border border-border px-3 py-1.5 text-[13px] font-[550] text-text-2 transition-colors hover:bg-bg-sunken disabled:opacity-50"
          >
            {busy ? "Desconectando…" : "Desconectar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={busy || disabled}
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-[600] text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {needsReconnect ? "Reconectar" : "Conectar"}
          </button>
        )}
      </div>
    </div>
  );
}
