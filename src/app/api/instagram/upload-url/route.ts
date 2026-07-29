import type { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getUploadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

const schema = z.object({ contentType: z.enum(["image/jpeg", "image/png"]) });

/**
 * POST /api/instagram/upload-url — URL prefirmada para subir la imagen del compositor
 * genérico directo a R2. La key se acota al tenant (`instagram/<orgId>/…`) para que `publish`
 * pueda validarla. owner+agent.
 */
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireMember();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Cuerpo inválido" } }, { status: 422 });
  }
  const ext = parsed.data.contentType === "image/png" ? "png" : "jpg";
  const key = `instagram/${ctx.organizationId}/${nanoid()}.${ext}`;
  const uploadUrl = await getUploadUrl(key, parsed.data.contentType);
  return Response.json({ uploadUrl, storageKey: key }, { status: 200 });
}
