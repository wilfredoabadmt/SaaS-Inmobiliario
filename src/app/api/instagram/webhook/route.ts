import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { verifyIgWebhookSignature, type IgWebhookPayload } from "@/lib/instagram";
import { processIgWebhook } from "@/server/instagram/webhook";

export const dynamic = "force-dynamic";

/** GET — handshake de verificación del webhook (compara el verify token). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = getEnv().IG_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && verifyToken === expected) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** POST — eventos. Valida firma (IG_APP_SECRET) → procesa idempotente → 200. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyIgWebhookSignature(raw, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: IgWebhookPayload;
  try {
    payload = JSON.parse(raw) as IgWebhookPayload;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    await processIgWebhook(payload);
  } catch (e) {
    // Best-effort: no propagar el error (la dedup protege ante reintentos). No loguear tokens.
    console.error("[ig-webhook] error procesando evento", e instanceof Error ? e.message : "");
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}
