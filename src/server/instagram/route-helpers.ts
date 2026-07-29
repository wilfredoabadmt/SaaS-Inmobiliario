import { MetaApiError } from "@/lib/meta";
import { getCredentials, markReconnectRequired } from "@/server/instagram/credentials";

/**
 * Utilidades compartidas por las rutas de Instagram (feature 008): cargar credenciales
 * conectadas y mapear errores de Graph a respuestas (token inválido → reconnect_required).
 */

export type ConnectedCreds = NonNullable<Awaited<ReturnType<typeof getCredentials>>>;

export async function getConnectedCredentials(
  organizationId: string,
): Promise<
  | { ok: true; creds: ConnectedCreds }
  | { ok: false; code: "not_connected" | "reconnect_required" }
> {
  const creds = await getCredentials(organizationId);
  if (!creds) return { ok: false, code: "not_connected" };
  if (creds.status !== "connected") return { ok: false, code: "reconnect_required" };
  return { ok: true, creds };
}

export function notConnectedResponse(code: "not_connected" | "reconnect_required"): Response {
  const message =
    code === "not_connected"
      ? "Instagram no está conectado"
      : "Reconecta tu cuenta de Instagram";
  return Response.json({ error: { code, message } }, { status: 409 });
}

/** ¿El error de Graph indica token inválido/expirado? */
export function isTokenError(e: unknown): boolean {
  if (!(e instanceof MetaApiError)) return false;
  if (e.status === 401) return true;
  const body = e.body as { error?: { code?: number } } | undefined;
  return body?.error?.code === 190;
}

/**
 * Causa legible de un error de Graph para mostrarla en la UI (módulo admin owner-only).
 * Usa el mensaje de usuario de Graph (`error_user_msg`/`message`) — NUNCA contiene tokens.
 */
export function igErrorDetail(e: unknown): string | undefined {
  if (e instanceof MetaApiError) {
    const body = e.body as
      | { error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number } }
      | undefined;
    const err = body?.error;
    const human = err?.error_user_msg || err?.message;
    if (human) {
      const codes = [err?.code, err?.error_subcode].filter((c) => c != null).join("/");
      return codes ? `${human} (${codes})` : human;
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return undefined;
}

/** Convierte un error de Graph en Response: token → 409 reconnect (y marca), si no 502. */
export async function mapInstagramError(organizationId: string, e: unknown): Promise<Response> {
  if (isTokenError(e)) {
    await markReconnectRequired(organizationId);
    return Response.json(
      { error: { code: "reconnect_required", message: "El token de Instagram expiró" } },
      { status: 409 },
    );
  }
  return Response.json(
    {
      error: {
        code: "instagram_error",
        message: "Error al comunicar con Instagram",
        detail: igErrorDetail(e),
      },
    },
    { status: 502 },
  );
}
