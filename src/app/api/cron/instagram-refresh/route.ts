import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { refreshExpiringTokens } from "@/server/instagram/refresh";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/instagram-refresh — renueva tokens próximos a expirar. Protegido por
 * `CRON_SECRET` (header `X-Cron-Secret`). Lo dispara una scheduled task diaria de Coolify.
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

  const result = await refreshExpiringTokens();
  return Response.json(
    { refreshed: result.refreshed, marked_reconnect: result.markedReconnect },
    { status: 200 },
  );
}
