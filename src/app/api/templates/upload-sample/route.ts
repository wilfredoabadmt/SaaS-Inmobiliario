import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { templateErrorPayload, uploadHeaderSample } from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/templates/upload-sample — sube la imagen de muestra de un header de imagen y devuelve
 * el `handle` para usar al crear la plantilla (DV-WT-5, owner). Body = bytes binarios de la imagen;
 * el Content-Type es el mime de la imagen.
 */
export async function POST(req: Request) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const mime = req.headers.get("content-type") ?? "";
  if (!mime.startsWith("image/")) {
    return Response.json({ error: { code: "invalid", message: "Sube una imagen (JPG/PNG)." } }, { status: 422 });
  }
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
    return Response.json({ error: { code: "invalid", message: "Imagen vacía o mayor a 5 MB." } }, { status: 422 });
  }

  try {
    const handle = await uploadHeaderSample(organizationId, buf, mime);
    return Response.json({ handle });
  } catch (e) {
    const { status, body } = templateErrorPayload(e);
    return Response.json(body, { status });
  }
}
