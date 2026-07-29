import type { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { graphRequest, MetaApiError, subscribeAppToWaba } from "@/lib/meta";
import { getCredentialRefs, upsertMetaCredentials } from "@/server/whatsapp/credentials";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(20),
  phoneNumberId: z.string().min(1).optional(),
  wabaId: z.string().min(1).optional(),
});

/**
 * POST /api/whatsapp/connect/manual — conexión/reconexión manual con un token de
 * System User (solo owner). Útil para el número de prueba y para tokens
 * autogestionados, sin pasar por Embedded Signup. El token llega por el cuerpo
 * (HTTPS), se valida contra Graph, se cifra y NUNCA se devuelve ni se registra
 * (Principio I). Si no se indican phoneNumberId/wabaId, reusa los ya conectados.
 */
export async function POST(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Cuerpo inválido" } }, { status: 422 });
  }
  const { token } = parsed.data;

  // Resolver número/WABA: usar los del cuerpo o reusar los ya conectados.
  const existing = await getCredentialRefs(organizationId);
  const phoneNumberId = parsed.data.phoneNumberId ?? existing?.phoneNumberId;
  const wabaId = parsed.data.wabaId ?? existing?.wabaId;
  if (!phoneNumberId || !wabaId) {
    return Response.json(
      {
        error: {
          code: "missing_refs",
          message:
            "No hay un número conectado para reusar. Indica phone_number_id y waba_id (API Setup de Meta).",
        },
      },
      { status: 422 },
    );
  }

  // Validar que el token puede acceder al número (y obtener el número legible).
  let displayPhoneNumber: string | undefined;
  try {
    const phoneRes = await graphRequest<{ display_phone_number?: string }>(
      `${phoneNumberId}?fields=display_phone_number`,
      { method: "GET" },
      token,
    );
    displayPhoneNumber = phoneRes.display_phone_number;
  } catch (e) {
    if (e instanceof MetaApiError) {
      return Response.json(
        {
          error: {
            code: "invalid_token",
            message:
              "El token no pudo validar el número. Revisa que sea de System User con permiso whatsapp_business_messaging sobre ese número.",
          },
        },
        { status: 502 },
      );
    }
    throw e;
  }

  // Suscribir la app al WABA (mejor esfuerzo: idempotente en Meta).
  try {
    await subscribeAppToWaba(wabaId, token);
  } catch (e) {
    if (!(e instanceof MetaApiError)) throw e;
  }

  // Guardar credenciales cifradas (el token nunca se devuelve).
  await upsertMetaCredentials(organizationId, {
    wabaId,
    phoneNumberId,
    displayPhoneNumber,
    accessToken: token,
  });

  return Response.json(
    { status: "connected", displayPhoneNumber: displayPhoneNumber ?? null },
    { status: 200 },
  );
}
