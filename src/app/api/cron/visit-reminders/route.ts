import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { sendDueReminders } from "@/server/calendar/reminders";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/visit-reminders — envía el recordatorio 1 h antes de cada visita. Protegido por
 * `CRON_SECRET` (header `X-Cron-Secret` o `?secret=`). Lo dispara una scheduled task de Coolify
 * cada ~5 min (DV-VS-10).
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

  const result = await sendDueReminders();
  return Response.json(result, { status: 200 });
}
