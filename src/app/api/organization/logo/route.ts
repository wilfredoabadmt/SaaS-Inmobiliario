import type { NextRequest } from "next/server";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { logoPostSchema } from "@/lib/organization/schemas";
import { confirmLogo, signLogo } from "@/server/organization/settings";

export const dynamic = "force-dynamic";

/** POST — subida del logo de la agencia en 2 fases (solo owner). */
export async function POST(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = logoPostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Imagen inválida (tipo o tamaño)", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  if (parsed.data.phase === "sign") {
    const signed = await signLogo(organizationId, parsed.data.contentType);
    return Response.json(signed);
  }

  const result = await confirmLogo(organizationId, { storageKey: parsed.data.storageKey });
  if (!result) {
    return Response.json(
      { error: { code: "invalid", message: "Clave de almacenamiento inválida" } },
      { status: 422 },
    );
  }
  return Response.json({ url: result.logoUrl });
}
