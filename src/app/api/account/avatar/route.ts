import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { avatarPostSchema } from "@/lib/account/schemas";
import { confirmAvatar, signAvatar } from "@/server/account/profile";

export const dynamic = "force-dynamic";

/**
 * POST — subida de avatar en 2 fases (US1):
 *  - "sign":    firma el PUT directo a R2 → { id, storageKey, uploadUrl }
 *  - "confirm": valida el prefijo del usuario y persiste user.image → { url }
 */
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = avatarPostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Imagen inválida (tipo o tamaño)", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  if (parsed.data.phase === "sign") {
    const signed = await signAvatar(userId, parsed.data.contentType);
    return Response.json(signed);
  }

  // phase === "confirm"
  const result = await confirmAvatar(userId, { storageKey: parsed.data.storageKey });
  if (!result) {
    return Response.json(
      { error: { code: "invalid", message: "Clave de almacenamiento inválida" } },
      { status: 422 },
    );
  }
  return Response.json({ url: result.avatarUrl });
}
