import type { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import {
  generateRegistrationPin,
  graphRequest,
  MetaApiError,
  registerPhoneNumber,
  subscribeAppToWaba,
} from "@/lib/meta";
import { upsertMetaCredentials } from "@/server/whatsapp/credentials";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
});

/** POST /api/whatsapp/connect — onboarding Embedded Signup (solo owner, FR-001/006). */
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
  const { code, wabaId, phoneNumberId } = parsed.data;
  const env = getEnv();

  // 1. Intercambiar el code del Embedded Signup por un token (server-side).
  const tokenRes = await graphRequest<{ access_token: string }>(
    `oauth/access_token?client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&code=${encodeURIComponent(code)}`,
    { method: "GET" },
  );
  const token = tokenRes.access_token;

  // 2. Suscribir la app al WABA del tenant para recibir sus webhooks.
  await subscribeAppToWaba(wabaId, token);

  // 3. Obtener el número legible.
  const phoneRes = await graphRequest<{ display_phone_number?: string }>(
    `${phoneNumberId}?fields=display_phone_number`,
    { method: "GET" },
    token,
  );

  // 4. Registrar el número en Cloud API (PENDIENTE -> activo). Tolerante a
  //    fallos: si ya estaba registrado o tiene 2FA previo, la conexión sigue
  //    siendo válida; se informa `activated` para que la UI lo refleje.
  let activated = false;
  try {
    await registerPhoneNumber(phoneNumberId, token, generateRegistrationPin());
    activated = true;
  } catch (e) {
    if (!(e instanceof MetaApiError)) throw e;
  }

  // 5. Guardar credenciales cifradas (token nunca se devuelve).
  await upsertMetaCredentials(organizationId, {
    wabaId,
    phoneNumberId,
    displayPhoneNumber: phoneRes.display_phone_number,
    accessToken: token,
  });

  return Response.json(
    {
      status: "connected",
      activated,
      displayPhoneNumber: phoneRes.display_phone_number ?? null,
    },
    { status: 200 },
  );
}
