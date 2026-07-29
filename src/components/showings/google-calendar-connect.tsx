"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

type GoogleStatus = "connected" | "reconnect_required" | "disconnected" | "none" | "not_configured";

interface StatusView {
  status: GoogleStatus;
  email: string | null;
}

const LABELS: Record<GoogleStatus, string> = {
  connected: "Conectado",
  reconnect_required: "Reconexión requerida",
  disconnected: "Desconectado",
  none: "No conectado",
  not_configured: "No disponible",
};

interface CalEntry {
  id: string;
  summary: string;
  primary: boolean;
  canWrite: boolean;
}

export function GoogleCalendarConnect() {
  const [view, setView] = useState<StatusView | null>(null);
  const [busy, setBusy] = useState(false);
  const [cals, setCals] = useState<CalEntry[] | null>(null);
  const [target, setTarget] = useState("primary");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [savingCals, setSavingCals] = useState(false);
  const [savedCals, setSavedCals] = useState(false);

  async function loadCalendars() {
    try {
      const res = await fetch("/api/calendar/google/calendars");
      if (!res.ok) {
        setCals(null);
        return;
      }
      const body = (await res.json()) as {
        calendars: CalEntry[];
        targetCalendarId: string;
        conflictCalendarIds: string[];
      };
      setCals(body.calendars);
      setTarget(body.targetCalendarId);
      setConflicts(body.conflictCalendarIds);
    } catch {
      setCals(null);
    }
  }

  function toggleConflict(id: string) {
    setSavedCals(false);
    setConflicts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function saveCals() {
    setSavingCals(true);
    setSavedCals(false);
    try {
      const res = await fetch("/api/calendar/google/calendars", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetCalendarId: target, conflictCalendarIds: conflicts }),
      });
      if (res.ok) setSavedCals(true);
    } finally {
      setSavingCals(false);
    }
  }

  async function load() {
    try {
      const res = await fetch("/api/calendar/google/status");
      if (res.status === 501) {
        setView({ status: "not_configured", email: null });
        return;
      }
      if (!res.ok) {
        setView({ status: "none", email: null });
        return;
      }
      const body = (await res.json()) as StatusView;
      setView(body);
      if (body.status === "connected") void loadCalendars();
    } catch {
      setView({ status: "none", email: null });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/calendar/google/disconnect", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const status = view?.status ?? "none";
  const connected = status === "connected" || status === "reconnect_required";

  return (
    <div>
      <div className="flex items-center gap-2">
        <RefreshCw size={15} className="text-text-3" />
        <h3 className="text-[13px] font-[650] text-text">Google Calendar</h3>
      </div>
      <p className="mt-1 text-[12px] text-text-3">
        Conecta tu Google Calendar para que tus eventos ocupados bloqueen horarios y cada visita se
        cree como evento en tu agenda.
      </p>

      {view === null ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-text-3">
          <Loader2 size={14} className="animate-spin" /> Cargando…
        </div>
      ) : status === "not_configured" ? (
        <p className="mt-3 text-[12px] text-text-4">
          La integración con Google Calendar no está configurada en este entorno.
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-[550] " +
              (status === "connected"
                ? "bg-emerald-50 text-emerald-700"
                : status === "reconnect_required"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-bg-sunken text-text-3")
            }
          >
            {LABELS[status]}
            {view.email ? <span className="text-text-4">· {view.email}</span> : null}
          </span>
          {connected ? (
            <>
              {status === "reconnect_required" && (
                <a
                  href="/api/calendar/google/connect"
                  className={buttonVariants({ size: "sm", variant: "accent" })}
                >
                  Reconectar
                </a>
              )}
              <Button onClick={disconnect} disabled={busy} size="sm" variant="outline">
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                Desconectar
              </Button>
            </>
          ) : (
            <a
              href="/api/calendar/google/connect"
              className={buttonVariants({ size: "sm", variant: "accent" })}
            >
              Conectar Google Calendar
            </a>
          )}
        </div>
      )}

      {status === "connected" && cals && cals.length > 0 && (
        <div className="mt-4 rounded-md border border-border bg-bg-sunken/40 p-3">
          <p className="text-[12px] font-[600] text-text-2">Calendario donde se crean las visitas</p>
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setSavedCals(false);
            }}
            className="mt-1 block h-8 w-full max-w-xs rounded-sm border border-border bg-bg px-2 text-sm text-text"
          >
            {cals
              .filter((c) => c.canWrite)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                  {c.primary ? " (principal)" : ""}
                </option>
              ))}
          </select>

          <p className="mt-3 text-[12px] font-[600] text-text-2">
            Calendarios que bloquean disponibilidad
          </p>
          <p className="text-[11px] text-text-4">
            Si tienes un evento ocupado en cualquiera de estos, ese horario no se ofrecerá.
          </p>
          <div className="mt-1.5 space-y-1">
            {cals.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-[12.5px] text-text-2">
                <input
                  type="checkbox"
                  checked={conflicts.includes(c.id)}
                  onChange={() => toggleConflict(c.id)}
                />
                {c.summary}
                {c.primary ? " (principal)" : ""}
              </label>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button onClick={saveCals} disabled={savingCals} size="sm" variant="outline">
              {savingCals ? <Loader2 size={14} className="animate-spin" /> : savedCals ? <Check size={14} /> : null}
              {savedCals ? "Guardado" : "Guardar calendarios"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
