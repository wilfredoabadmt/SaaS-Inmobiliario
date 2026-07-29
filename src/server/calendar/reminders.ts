import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { showing } from "@/lib/db/schema/domain";
import { sendShowingEmail } from "@/server/calendar/notify";

/**
 * Recordatorio por email ~1 h antes de cada visita (feature 011, US3). Lo invoca un cron
 * frecuente (cada ~5 min). Idempotente: marca `reminder_email_sent_at` tras intentar el envío,
 * así nunca se reenvía (exactamente-una-vez, DV-VS-10). Best-effort por fila.
 */
export async function sendDueReminders(): Promise<{ sent: number; scanned: number }> {
  const db = getDb();
  const now = new Date();
  const horizon = new Date(now.getTime() + 65 * 60_000);

  const due = await db
    .select({ id: showing.id })
    .from(showing)
    .where(
      and(
        eq(showing.status, "agendada"),
        isNull(showing.reminderEmailSentAt),
        gt(showing.scheduledAt, now),
        lte(showing.scheduledAt, horizon),
      ),
    );

  let sent = 0;
  for (const row of due) {
    let ok = false;
    try {
      ok = await sendShowingEmail("reminder", row.id);
    } catch (e) {
      console.error("[reminders] envío falló:", e instanceof Error ? e.message : String(e));
    }
    if (ok) sent += 1;
    // Marca idempotente aun si el envío falló: evita reintentos infinitos cada 5 min.
    await db
      .update(showing)
      .set({ reminderEmailSentAt: new Date() })
      .where(eq(showing.id, row.id));
  }

  return { sent, scanned: due.length };
}
