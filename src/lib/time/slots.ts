import { DateTime } from "luxon";
import { WEEKDAY_KEYS, type Interval, type WeekdayKey } from "@/server/calendar/types";

/**
 * Helpers de tiempo del calendario (feature 011). Aritmética de timezone/DST con luxon
 * (DV-VS-8). Puros: sin acceso a BD. Todas las salidas de instante son ISO 8601 en UTC.
 */

export interface UtcInterval {
  startUtc: string;
  endUtc: string;
}

/** ¿Es válida una timezone IANA? (para validar settings). */
export function isValidTimezone(tz: string): boolean {
  return DateTime.local().setZone(tz).isValid;
}

/** Clave de día (lun..dom) de una fecha `YYYY-MM-DD` interpretada en `tz`. */
export function weekdayKeyOf(dayISODate: string, tz: string): WeekdayKey {
  const dt = DateTime.fromISO(dayISODate, { zone: tz });
  // luxon weekday: 1=lunes .. 7=domingo
  return WEEKDAY_KEYS[dt.weekday - 1] ?? "mon";
}

/**
 * Expande los intervalos de un día (wall-clock en `tz`) en slots de `slotMinutes`, avanzando
 * `slotMinutes + bufferMinutes` por paso. Solo emite slots cuyo fin cae dentro del intervalo.
 */
export function expandWorkingDayToUtc(
  dayISODate: string,
  intervals: Interval[],
  tz: string,
  slotMinutes: number,
  bufferMinutes: number,
): UtcInterval[] {
  const step = slotMinutes + Math.max(0, bufferMinutes);
  if (slotMinutes <= 0 || step <= 0) return [];
  const out: UtcInterval[] = [];
  for (const iv of intervals) {
    const start = DateTime.fromISO(`${dayISODate}T${iv.start}`, { zone: tz });
    const end = DateTime.fromISO(`${dayISODate}T${iv.end}`, { zone: tz });
    if (!start.isValid || !end.isValid || end <= start) continue;
    let cursor = start;
    while (cursor.plus({ minutes: slotMinutes }) <= end) {
      const slotEnd = cursor.plus({ minutes: slotMinutes });
      const startUtc = cursor.toUTC().toISO();
      const endUtc = slotEnd.toUTC().toISO();
      if (startUtc && endUtc) out.push({ startUtc, endUtc });
      cursor = cursor.plus({ minutes: step });
    }
  }
  return out;
}

/** Lista de fechas `YYYY-MM-DD` (en `tz`) entre dos instantes UTC, inclusive. */
export function eachDateInRange(fromUtc: string, toUtc: string, tz: string): string[] {
  const start = DateTime.fromISO(fromUtc, { zone: "utc" }).setZone(tz).startOf("day");
  const end = DateTime.fromISO(toUtc, { zone: "utc" }).setZone(tz).startOf("day");
  if (!start.isValid || !end.isValid || end < start) return [];
  const dates: string[] = [];
  let d = start;
  let guard = 0;
  while (d <= end && guard < 366) {
    const iso = d.toFormat("yyyy-MM-dd");
    dates.push(iso);
    d = d.plus({ days: 1 });
    guard += 1;
  }
  return dates;
}

/** ¿Se solapan [aStart,aEnd) y [bStart,bEnd)? (instantes ISO). */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = Date.parse(aStart);
  const ae = Date.parse(aEnd);
  const bs = Date.parse(bStart);
  const be = Date.parse(bEnd);
  return as < be && bs < ae;
}

/** Etiqueta legible en español en la tz del asesor, p. ej. "mié 25 jun, 10:00". */
export function labelInTz(startUtc: string, tz: string): string {
  const dt = DateTime.fromISO(startUtc, { zone: "utc" }).setZone(tz).setLocale("es");
  return dt.isValid ? dt.toFormat("ccc d LLL, HH:mm") : startUtc;
}
