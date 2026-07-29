import { and, eq, gte, lte, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { showing } from "@/lib/db/schema/domain";
import {
  eachDateInRange,
  expandWorkingDayToUtc,
  labelInTz,
  overlaps,
  weekdayKeyOf,
  type UtcInterval,
} from "@/lib/time/slots";
import { getSettings } from "@/server/calendar/settings";
import { getGoogleBusy } from "@/server/calendar/google";
import type { AvailabilityResult, AvailabilitySlot } from "@/server/calendar/types";

/**
 * Motor de disponibilidad (feature 011, US1/US4). Slots libres del asesor =
 * horas hábiles − visitas Inmox (status 'agendada') − ocupado de Google (si conectado).
 * Degrada a "horas hábiles − visitas Inmox" si Google no está conectado o falla (DV-VS-13).
 * Todo en instantes UTC; el cálculo wall-clock→UTC usa la timezone del asesor (luxon).
 */
export async function computeAvailability(
  organizationId: string,
  agentId: string,
  fromISO: string,
  toISO: string,
  opts: { excludeShowingId?: string } = {},
): Promise<AvailabilityResult> {
  const settings = await getSettings(organizationId, agentId);
  const tz = settings.timezone;
  const nowMs = Date.now();

  // 1) Slots candidatos por día dentro de la ventana.
  const candidates: UtcInterval[] = [];
  for (const date of eachDateInRange(fromISO, toISO, tz)) {
    const intervals = settings.weeklyHours[weekdayKeyOf(date, tz)] ?? [];
    candidates.push(
      ...expandWorkingDayToUtc(date, intervals, tz, settings.slotMinutes, settings.bufferMinutes),
    );
  }

  // 2) Visitas ya agendadas del asesor (bloqueos locales).
  const showings = await getDb()
    .select({
      id: showing.id,
      scheduledAt: showing.scheduledAt,
      durationMinutes: showing.durationMinutes,
    })
    .from(showing)
    .where(
      and(
        eq(showing.organizationId, organizationId),
        eq(showing.agentId, agentId),
        ne(showing.status, "cancelada"),
        gte(showing.scheduledAt, new Date(Date.parse(fromISO) - 24 * 3_600_000)),
        lte(showing.scheduledAt, new Date(toISO)),
      ),
    );
  const localBusy: UtcInterval[] = showings
    .filter((s) => s.id !== opts.excludeShowingId)
    .map((s) => {
      const start = s.scheduledAt.toISOString();
      const dur = s.durationMinutes ?? settings.slotMinutes;
      return {
        startUtc: start,
        endUtc: new Date(s.scheduledAt.getTime() + dur * 60_000).toISOString(),
      };
    });

  // 3) Ocupado de Google (si conectado). Degrada a [] si no conectado / falla.
  const google = await getGoogleBusy(organizationId, agentId, fromISO, toISO);
  const busy = [...localBusy, ...google.busy];

  // 4) Filtrar: futuros y sin solape con ningún bloqueo.
  const slots: AvailabilitySlot[] = candidates
    .filter((c) => Date.parse(c.startUtc) > nowMs)
    .filter((c) => !busy.some((b) => overlaps(c.startUtc, c.endUtc, b.startUtc, b.endUtc)))
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc))
    .map((c) => ({ startUtc: c.startUtc, endUtc: c.endUtc, label: labelInTz(c.startUtc, tz) }));

  return { agentId, timezone: tz, googleConnected: google.connected, slots };
}

/**
 * Re-valida que `whenISO` sea un slot disponible del asesor (DV-VS-4). Devuelve el slot
 * (con su fin/duración) o `null` si ya no está disponible. `excludeShowingId` permite no
 * contar la visita que se está reprogramando como ocupada de sí misma.
 */
export async function findSlot(
  organizationId: string,
  agentId: string,
  whenISO: string,
  opts: { excludeShowingId?: string } = {},
): Promise<AvailabilitySlot | null> {
  const whenMs = Date.parse(whenISO);
  if (!Number.isFinite(whenMs)) return null;
  const from = new Date(whenMs - 24 * 3_600_000).toISOString();
  const to = new Date(whenMs + 24 * 3_600_000).toISOString();
  const { slots } = await computeAvailability(organizationId, agentId, from, to, opts);
  return slots.find((s) => Date.parse(s.startUtc) === whenMs) ?? null;
}
