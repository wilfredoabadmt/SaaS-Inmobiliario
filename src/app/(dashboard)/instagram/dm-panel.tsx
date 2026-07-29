"use client";

import { useEffect, useState } from "react";

interface ThreadMessage {
  id: string;
  from?: { id: string; username?: string };
  message?: string;
  created_time?: string;
}
interface Thread {
  id: string;
  participants?: { data?: Array<{ id: string; username?: string }> };
  messages?: { data?: ThreadMessage[] };
}

/** Panel de mensajes directos (feature 008, US4). Lectura en vivo + responder en 24 h. */
export function DmPanel({ igUserId }: { igUserId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string>("");
  const [replyText, setReplyText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/instagram/conversations");
      const data = (await res.json()) as { threads?: Thread[]; error?: { message?: string } };
      if (res.ok) setThreads(data.threads ?? []);
      else setError(data.error?.message ?? "No se pudieron cargar las conversaciones.");
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function counterparty(t: Thread): { id: string; username?: string } | null {
    return t.participants?.data?.find((p) => p.id !== igUserId) ?? null;
  }

  async function send(recipientIgsid: string) {
    if (!replyText.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/instagram/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientIgsid, text: replyText }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (res.ok) {
        setReplyFor("");
        setReplyText("");
        setNotice("Mensaje enviado.");
      } else {
        setNotice(data.error?.message ?? "No se pudo enviar.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-[600] text-text">Conversaciones</h2>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="rounded-md border border-border px-2.5 py-1 text-[12px] text-text-2 hover:bg-bg-sunken disabled:opacity-50"
        >
          Recargar
        </button>
      </div>

      {error && <div className="mt-2 text-[12px] text-[color:var(--match-no-text)]">{error}</div>}
      {notice && <div className="mt-2 text-[12px] text-text-2">{notice}</div>}

      <div className="mt-3 space-y-2">
        {threads.map((t) => {
          const cp = counterparty(t);
          const msgs = t.messages?.data ?? [];
          return (
            <div key={t.id} className="rounded-md border border-border bg-bg p-2.5">
              <div className="text-[12px] text-text-3">@{cp?.username ?? cp?.id ?? "usuario"}</div>
              <div className="mt-1 space-y-0.5">
                {msgs.slice(0, 3).map((m) => (
                  <div key={m.id} className="text-[13px] text-text">
                    {m.message}
                  </div>
                ))}
              </div>
              {cp && (
                <div className="mt-1.5">
                  {replyFor === t.id ? (
                    <div className="flex gap-2">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Responder…"
                        className="flex-1 rounded-md border border-border-strong bg-bg px-2 py-1 text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-accent-tint"
                      />
                      <button
                        type="button"
                        onClick={() => send(cp.id)}
                        disabled={busy}
                        className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-[600] text-white hover:bg-accent-hover disabled:opacity-50"
                      >
                        Enviar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReplyFor(t.id)}
                      className="text-[12px] text-accent-text"
                    >
                      Responder
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {threads.length === 0 && !busy && (
          <div className="text-[12px] text-text-3">Sin conversaciones.</div>
        )}
      </div>
    </div>
  );
}
