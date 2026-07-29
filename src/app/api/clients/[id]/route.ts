import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { clientUpdateSchema } from "@/lib/clients/schemas";
import { getClientDetail, updateClient } from "@/server/clients/service";

export const dynamic = "force-dynamic";

const notFound = () =>
  Response.json(
    { error: { code: "not_found", message: "Contacto no encontrado" } },
    { status: 404 },
  );

/** GET — detalle del contacto del tenant (404 si es de otra org). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const detail = await getClientDetail(organizationId, id);
  if (!detail) return notFound();
  return Response.json(detail);
}

/** PATCH — edita parcialmente el contacto del tenant (US1). 409 si el teléfono ya existe. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const { id } = await params;
  const parsed = clientUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const result = await updateClient(organizationId, id, parsed.data);
  if (!result.ok) {
    if (result.reason === "not_found") return notFound();
    return Response.json(
      { error: { code: "phone_taken", message: "Ya existe un contacto con ese teléfono." } },
      { status: 409 },
    );
  }
  return Response.json({ id: result.id });
}
