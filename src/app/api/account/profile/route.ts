import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { profileUpdateSchema } from "@/lib/account/schemas";
import { updateName } from "@/server/account/profile";

export const dynamic = "force-dynamic";

/** PATCH — actualiza el nombre visible del usuario autenticado (US1). */
export async function PATCH(req: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = profileUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Nombre inválido", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  await updateName(userId, parsed.data.name);
  return Response.json({ ok: true, name: parsed.data.name });
}
