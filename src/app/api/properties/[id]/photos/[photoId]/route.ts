import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { photoPatchSchema } from "@/lib/properties/schemas";
import { deletePhoto, reorderPhoto } from "@/server/properties/photos";

export const dynamic = "force-dynamic";

const notFound = () =>
  Response.json({ error: { code: "not_found", message: "Foto no encontrada" } }, { status: 404 });

/** PATCH — reordena la foto (`sortOrder`) o la marca principal (`make_main`). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id, photoId } = await params;
  const parsed = photoPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Solicitud inválida" } }, { status: 422 });
  }

  const photos = await reorderPhoto(organizationId, id, photoId, parsed.data);
  if (!photos) return notFound();
  return Response.json({ photos });
}

/** DELETE — elimina la foto (objeto + fila) y renumera; principal pasa a la siguiente. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id, photoId } = await params;
  const photos = await deletePhoto(organizationId, id, photoId);
  if (!photos) return notFound();
  return Response.json({ deleted: true, photos });
}
