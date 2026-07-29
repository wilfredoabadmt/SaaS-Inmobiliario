import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { exchangeCode } from "@/lib/google";
import { verifyState } from "@/lib/google/state";
import { saveCredentials } from "@/server/calendar/google";

export const dynamic = "force-dynamic";

/** GET /api/calendar/google/callback — completa el OAuth: verifica state, intercambia, guarda. */
export async function GET(req: NextRequest) {
  const base = getEnv().APP_BASE_URL.replace(/\/$/, "");
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const ok = state ? verifyState(state) : null;
  if (!code || !ok) {
    return Response.redirect(`${base}/showings?google=error`, 302);
  }
  try {
    const tokens = await exchangeCode(code);
    await saveCredentials(ok.organizationId, ok.userId, tokens);
    return Response.redirect(`${base}/showings?google=connected`, 302);
  } catch {
    return Response.redirect(`${base}/showings?google=error`, 302);
  }
}
