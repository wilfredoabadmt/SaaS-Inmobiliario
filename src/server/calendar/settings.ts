import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { calendarSettings } from "@/lib/db/schema/domain";
import { isValidTimezone } from "@/lib/time/slots";
import {
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_SLOT_MINUTES,
  DEFAULT_TIMEZONE,
  DEFAULT_WEEKLY_HOURS,
  WEEKDAY_KEYS,
  type CalendarSettingsView,
  type Interval,
  type WeeklyHours,
} from "@/server/calendar/types";

/**
 * Configuración de calendario por asesor (feature 011, US1). 1:1 por (organization_id, user_id).
 * Si el asesor no tiene fila, `getSettings` devuelve un default VIRTUAL (no se persiste hasta
 * que guarde, DV-VS-14). La validación de dominio (horas válidas, sin solapes) vive aquí para
 * que tanto los endpoints como el agente operen sobre datos consistentes.
 */

export class CalendarSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarSettingsError";
  }
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/** Normaliza + valida `weekly_hours` crudo (jsonb) a `WeeklyHours`. Lanza si es inválido. */
export function normalizeWeeklyHours(raw: unknown): WeeklyHours {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = {} as WeeklyHours;
  for (const day of WEEKDAY_KEYS) {
    const list = Array.isArray(src[day]) ? (src[day] as unknown[]) : [];
    const intervals: Interval[] = [];
    for (const item of list) {
      const iv = item as { start?: unknown; end?: unknown };
      const start = typeof iv.start === "string" ? iv.start : "";
      const end = typeof iv.end === "string" ? iv.end : "";
      if (!HHMM.test(start) || !HHMM.test(end)) {
        throw new CalendarSettingsError(`Horario inválido en ${day}: ${start}-${end} (usa HH:MM)`);
      }
      if (toMinutes(start) >= toMinutes(end)) {
        throw new CalendarSettingsError(`En ${day}, el inicio debe ser anterior al fin (${start}-${end})`);
      }
      intervals.push({ start, end });
    }
    // No solapes dentro del día.
    intervals.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < intervals.length; i++) {
      if (toMinutes(intervals[i]!.start) < toMinutes(intervals[i - 1]!.end)) {
        throw new CalendarSettingsError(`Horarios solapados en ${day}`);
      }
    }
    out[day] = intervals;
  }
  return out;
}

export interface UpsertSettingsInput {
  weeklyHours: unknown;
  slotMinutes: number;
  bufferMinutes: number;
  timezone: string;
}

function validateInput(input: UpsertSettingsInput): {
  weeklyHours: WeeklyHours;
  slotMinutes: number;
  bufferMinutes: number;
  timezone: string;
} {
  const weeklyHours = normalizeWeeklyHours(input.weeklyHours);
  const slotMinutes = Math.trunc(input.slotMinutes);
  const bufferMinutes = Math.trunc(input.bufferMinutes);
  if (!Number.isFinite(slotMinutes) || slotMinutes < 10 || slotMinutes > 480) {
    throw new CalendarSettingsError("La duración del slot debe estar entre 10 y 480 minutos");
  }
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 240) {
    throw new CalendarSettingsError("El buffer debe estar entre 0 y 240 minutos");
  }
  if (!isValidTimezone(input.timezone)) {
    throw new CalendarSettingsError(`Timezone inválida: ${input.timezone}`);
  }
  return { weeklyHours, slotMinutes, bufferMinutes, timezone: input.timezone };
}

/** Configuración del asesor (o el default virtual si no tiene fila). */
export async function getSettings(
  organizationId: string,
  userId: string,
): Promise<CalendarSettingsView> {
  const rows = await getDb()
    .select()
    .from(calendarSettings)
    .where(
      and(
        eq(calendarSettings.organizationId, organizationId),
        eq(calendarSettings.userId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return {
      weeklyHours: DEFAULT_WEEKLY_HOURS,
      slotMinutes: DEFAULT_SLOT_MINUTES,
      bufferMinutes: DEFAULT_BUFFER_MINUTES,
      timezone: DEFAULT_TIMEZONE,
      isDefault: true,
    };
  }
  return {
    weeklyHours: normalizeWeeklyHours(row.weeklyHours),
    slotMinutes: row.slotMinutes,
    bufferMinutes: row.bufferMinutes,
    timezone: row.timezone,
    isDefault: false,
  };
}

/** Crea/actualiza la configuración del asesor (1:1). Lanza `CalendarSettingsError` si inválido. */
export async function upsertSettings(
  organizationId: string,
  userId: string,
  input: UpsertSettingsInput,
): Promise<void> {
  const v = validateInput(input);
  const db = getDb();
  await db
    .insert(calendarSettings)
    .values({
      id: newId("calendarSettings"),
      organizationId,
      userId,
      weeklyHours: v.weeklyHours,
      slotMinutes: v.slotMinutes,
      bufferMinutes: v.bufferMinutes,
      timezone: v.timezone,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [calendarSettings.organizationId, calendarSettings.userId],
      set: {
        weeklyHours: v.weeklyHours,
        slotMinutes: v.slotMinutes,
        bufferMinutes: v.bufferMinutes,
        timezone: v.timezone,
        updatedAt: new Date(),
      },
    });
}
