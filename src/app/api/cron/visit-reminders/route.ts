import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { sendDueReminders } from "@/server/calendar/reminders";
import { sendDueClientWaReminders } from "@/server/showings/client-reminder";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/visit-reminders — envía:
 * 1. Recordatorio 1 h antes al asesor por correo electrónico.
 * 2. Recordatorio ~24 h antes al cliente por WhatsApp (Feature 016).
 *
 * Protegido por `CRON_SECRET` (header `X-Cron-Secret` o `?secret=`).
 */
export async function POST(req: NextRequest) {
  const secret = getEnv().CRON_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return Response.json(
      { error: { code: "unauthorized", message: "Cron no autorizado" } },
      { status: 401 },
    );
  }

  const [emailResult, waResult] = await Promise.all([
    sendDueReminders(),
    sendDueClientWaReminders(),
  ]);

  return Response.json(
    {
      adviserEmail: emailResult,
      clientWhatsApp: waResult,
    },
    { status: 200 },
  );
}
