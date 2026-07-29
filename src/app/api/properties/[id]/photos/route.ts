import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { photoPostSchema } from "@/lib/properties/schemas";
import { confirmPhoto, signUpload } from "@/server/properties/photos";

export const dynamic = "force-dynamic";

const notFound = () =>
  Response.json(
    { error: { code: "not_found", message: "Propiedad no encontrada" } },
    { status: 404 },
  );

/**
 * POST — subida de foto en 2 pasos (DV-2):
 *  - phase "sign":   valida + firma el PUT directo a R2 → { photoId, storageKey, uploadUrl }
 *  - phase "confirm": crea la fila property_photo al final del orden → { photo… }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const parsed = photoPostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Foto inválida (tipo o tamaño)", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  if (parsed.data.phase === "sign") {
    const signed = await signUpload(organizationId, id, parsed.data.contentType);
    if (!signed) return notFound();
    return Response.json(signed);
  }

  // phase === "confirm"
  const photos = await confirmPhoto(organizationId, id, {
    photoId: parsed.data.photoId,
    storageKey: parsed.data.storageKey,
    contentType: parsed.data.contentType,
    sizeBytes: parsed.data.sizeBytes,
  });
  if (!photos) {
    return Response.json(
      { error: { code: "invalid", message: "Clave de almacenamiento o propiedad inválida" } },
      { status: 422 },
    );
  }
  return Response.json({ photos }, { status: 201 });
}
