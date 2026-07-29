"use client";

import { useEffect, useState } from "react";
import { Calendar, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleCalendarConnect } from "@/components/showings/google-calendar-connect";

/** Días de la semana en el orden de `weekly_hours` (lun..dom). */
const DAYS = [
  { key: "mon", label: "Lun" },
  { key: "tue", label: "Mar" },
  { key: "wed", label: "Mié" },
  { key: "thu", label: "Jue" },
  { key: "fri", label: "Vie" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];
interface Interval {
  start: string;
  end: string;
}
type WeeklyHours = Record<DayKey, Interval[]>;

interface SettingsView {
  weeklyHours: WeeklyHours;
  slotMinutes: number;
  bufferMinutes: number;
  timezone: string;
  isDefault: boolean;
}

/** Estado editable simplificado: un rango por día (enabled + start/end). */
interface DayRow {
  enabled: boolean;
  start: string;
  end: string;
}

function toRows(weekly: WeeklyHours): Record<DayKey, DayRow> {
  const rows = {} as Record<DayKey, DayRow>;
  for (const { key } of DAYS) {
    const first = weekly[key]?.[0];
    rows[key] = first
      ? { enabled: true, start: first.start, end: first.end }
      : { enabled: false, start: "09:00", end: "18:00" };
  }
  return rows;
}

function toWeekly(rows: Record<DayKey, DayRow>): WeeklyHours {
  const weekly = {} as WeeklyHours;
  for (const { key } of DAYS) {
    const r = rows[key];
    weekly[key] = r.enabled ? [{ start: r.start, end: r.end }] : [];
  }
  return weekly;
}

const TIMEZONES = [
  "America/Mexico_City",
  "America/Monterrey",
  "America/Tijuana",
  "America/Cancun",
  "America/Bogota",
  "America/Lima",
  "America/Argentina/Buenos_Aires",
  "America/New_York",
];

export function CalendarSettingsPanel() {
  const [rows, setRows] = useState<Record<DayKey, DayRow> | null>(null);
  const [slot, setSlot] = useState(60);
  const [buffer, setBuffer] = useState(0);
  const [tz, setTz] = useState("America/Mexico_City");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/calendar/settings")
      .then((r) => r.json())
      .then((s: SettingsView) => {
        if (!alive) return;
        setRows(toRows(s.weeklyHours));
        setSlot(s.slotMinutes);
        setBuffer(s.bufferMinutes);
        setTz(s.timezone);
      })
      .catch(() => alive && setError("No se pudo cargar la configuración"));
    return () => {
      alive = false;
    };
  }, []);

  function updateDay(key: DayKey, patch: Partial<DayRow>) {
    setRows((prev) => (prev ? { ...prev, [key]: { ...prev[key], ...patch } } : prev));
    setSaved(false);
  }

  async function save() {
    if (!rows) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weeklyHours: toWeekly(rows),
          slotMinutes: slot,
          bufferMinutes: buffer,
          timezone: tz,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "No se pudo guardar");
        return;
      }
      setSaved(true);
    } catch {
      setError("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-lg border border-border bg-bg-panel p-4 shadow-rest">
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-text-3" />
        <h2 className="text-[13.5px] font-[650] text-text">Mi disponibilidad</h2>
      </div>
      <p className="mt-1 text-[12px] text-text-3">
        Define tus horas hábiles y la duración de cada visita. El asistente solo ofrecerá horarios
        dentro de esta ventana.
      </p>

      {!rows ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-text-3">
          <Loader2 size={15} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-1.5">
            {DAYS.map(({ key, label }) => {
              const r = rows[key];
              return (
                <div key={key} className="flex items-center gap-3">
                  <label className="flex w-20 shrink-0 items-center gap-2 text-[12.5px] text-text-2">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                    />
                    {label}
                  </label>
                  <Input
                    type="time"
                    value={r.start}
                    disabled={!r.enabled}
                    onChange={(e) => updateDay(key, { start: e.target.value })}
                    className="h-8 w-36"
                  />
                  <span className="text-text-4">–</span>
                  <Input
                    type="time"
                    value={r.end}
                    disabled={!r.enabled}
                    onChange={(e) => updateDay(key, { end: e.target.value })}
                    className="h-8 w-36"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="text-[12px] text-text-2">
              Duración de la visita
              <select
                value={slot}
                onChange={(e) => {
                  setSlot(Number(e.target.value));
                  setSaved(false);
                }}
                className="mt-1 block h-8 rounded-sm border border-border bg-bg px-2 text-sm text-text"
              >
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-text-2">
              Margen entre visitas
              <select
                value={buffer}
                onChange={(e) => {
                  setBuffer(Number(e.target.value));
                  setSaved(false);
                }}
                className="mt-1 block h-8 rounded-sm border border-border bg-bg px-2 text-sm text-text"
              >
                {[0, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-text-2">
              Zona horaria
              <select
                value={tz}
                onChange={(e) => {
                  setTz(e.target.value);
                  setSaved(false);
                }}
                className="mt-1 block h-8 rounded-sm border border-border bg-bg px-2 text-sm text-text"
              >
                {TIMEZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={save} disabled={saving} size="sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
              {saved ? "Guardado" : "Guardar disponibilidad"}
            </Button>
            {error && <span className="text-[12px] text-red-500">{error}</span>}
          </div>
        </>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <GoogleCalendarConnect />
      </div>
    </section>
  );
}
