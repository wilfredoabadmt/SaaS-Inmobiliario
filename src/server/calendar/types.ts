/**
 * Tipos compartidos del calendario (feature 011). Ver
 * specs/011-visit-scheduling/data-model.md.
 */

/** Día de la semana (lun..dom). Coincide con las claves de `weekly_hours`. */
export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Intervalo de atención en wall-clock `HH:MM` (24h) de la timezone del asesor. */
export interface Interval {
  start: string;
  end: string;
}

/** Horas hábiles por día. Lista vacía = día no laborable. */
export type WeeklyHours = Record<WeekdayKey, Interval[]>;

/** Vista de la configuración para la UI/API (sin secretos). */
export interface CalendarSettingsView {
  weeklyHours: WeeklyHours;
  slotMinutes: number;
  bufferMinutes: number;
  timezone: string;
  /** true si es el default virtual (el asesor aún no guardó). */
  isDefault: boolean;
}

/** Slot disponible calculado (no se persiste). */
export interface AvailabilitySlot {
  /** Instante exacto de inicio en UTC (ISO 8601). */
  startUtc: string;
  /** startUtc + slotMinutes (ISO 8601 UTC). */
  endUtc: string;
  /** Etiqueta legible en la tz del asesor, p. ej. "mié 25 jun, 10:00". */
  label: string;
}

/** Resultado del motor de disponibilidad. */
export interface AvailabilityResult {
  agentId: string;
  timezone: string;
  googleConnected: boolean;
  slots: AvailabilitySlot[];
}

/** Default virtual de horas hábiles: L–V 09:00–18:00 (DV-VS-14). */
export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  mon: [{ start: "09:00", end: "18:00" }],
  tue: [{ start: "09:00", end: "18:00" }],
  wed: [{ start: "09:00", end: "18:00" }],
  thu: [{ start: "09:00", end: "18:00" }],
  fri: [{ start: "09:00", end: "18:00" }],
  sat: [],
  sun: [],
};

export const DEFAULT_SLOT_MINUTES = 60;
export const DEFAULT_BUFFER_MINUTES = 0;
export const DEFAULT_TIMEZONE = "America/Mexico_City";
