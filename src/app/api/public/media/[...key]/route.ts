import type { NextRequest } from "next/server";
import { verifyMediaToken } from "@/lib/instagram/media-token";
import { getObjectStream } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/media/[...key] — proxy PÚBLICO de objetos R2 (DV-IG-4). Lo consumen los
 * servidores de Meta para descargar la imagen a publicar. Sin sesión: la seguridad es el
 * token HMAC por-objeto con expiración. Sirve SOLO la key firmada (no enumera otros objetos).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const objectKey = key.map(decodeURIComponent).join("/");

  const url = new URL(req.url);
  const exp = Number(url.searchParams.get("exp"));
  const token = url.searchParams.get("token") ?? "";

  if (!verifyMediaToken(objectKey, exp, token)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const { body, contentType } = await getObjectStream(objectKey);
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
