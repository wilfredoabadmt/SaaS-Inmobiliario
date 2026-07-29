import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { MetaApiError } from "@/lib/instagram";
import { completeConnection, verifyState } from "@/server/instagram/oauth";

export const dynamic = "force-dynamic";

/**
 * Extrae una razón compacta y SIN secretos del error del intercambio. `e.message` ya codifica
 * el paso + status (p. ej. "IG oauth short token (400)"); `e.body` es el cuerpo de error de
 * Instagram (no contiene tokens) y suele traer `error_message` con la causa real.
 */
function igErrorReason(e: unknown): string {
  if (e instanceof MetaApiError) {
    const body = e.body as
      | { error_message?: string; error?: { message?: string }; error_description?: string }
      | undefined;
    const detail = body?.error_message ?? body?.error?.message ?? body?.error_description ?? "";
    return `${e.message} ${detail}`.trim().slice(0, 220);
  }
  return e instanceof Error ? e.message.slice(0, 160) : "error inesperado";
}

/**
 * GET /api/instagram/callback — vuelta del OAuth. La agencia viaja firmada en el `state`
 * (no requiere sesión). Valida state → intercambia code → guarda cifrado → suscribe webhooks.
 * Cualquier fallo redirige a `?ig=error&reason=…` (sin tokens) y loguea la causa. El `reason`
 * se renderiza en la página de Configuración para diagnosticar sin depender de logs del panel.
 */
export async function GET(req: NextRequest) {
  const base = getEnv().APP_BASE_URL.replace(/\/$/, "");
  const settingsUrl = (q: string, reason?: string) =>
    `${base}/settings/instagram?ig=${q}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Rechazo en la pantalla de autorización (negó / app no Live / no es tester): ?error=… sin code.
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const desc = url.searchParams.get("error_description") ?? "";
    console.error("[ig-callback] authorize rechazado:", oauthError, desc);
    return Response.redirect(settingsUrl("error", `authorize: ${oauthError} ${desc}`.trim()), 302);
  }

  if (!code || !state) {
    console.error("[ig-callback] falta code o state (code?", Boolean(code), "state?", Boolean(state), ")");
    return Response.redirect(settingsUrl("error", "falta code o state en el callback"), 302);
  }

  const verified = verifyState(state);
  if (!verified) {
    console.error("[ig-callback] state inválido o expirado");
    return Response.redirect(settingsUrl("error", "state inválido o expirado"), 302);
  }

  try {
    await completeConnection(verified.organizationId, code);
  } catch (e) {
    const reason = igErrorReason(e);
    if (e instanceof MetaApiError) {
      console.error("[ig-callback] intercambio falló:", e.status, e.message, JSON.stringify(e.body));
    } else {
      console.error("[ig-callback] error inesperado:", e instanceof Error ? e.message : e);
    }
    return Response.redirect(settingsUrl("error", reason), 302);
  }
  return Response.redirect(settingsUrl("connected"), 302);
}
