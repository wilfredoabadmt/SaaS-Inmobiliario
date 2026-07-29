import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { clientCreateSchema } from "@/lib/clients/schemas";
import { createClient } from "@/server/clients/service";
import { listClients } from "@/server/clients/queries";

export const dynamic = "force-dynamic";

const phoneTakenResponse = () =>
  Response.json(
    { error: { code: "phone_taken", message: "Ya existe un contacto con ese teléfono." } },
    { status: 409 },
  );

/** POST — crea un contacto manual del tenant (US1). */
export async function POST(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = clientCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Datos inválidos", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const result = await createClient(organizationId, parsed.data);
  if (!result.ok) return phoneTakenResponse();
  return Response.json({ id: result.id }, { status: 201 });
}

/** GET — lista los contactos del tenant (refresco del cliente; el primer render es SSR). */
export async function GET(req: NextRequest) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? undefined;
  const a = sp.get("archived");
  const archived = a === "archived" || a === "all" ? a : "active";
  const clients = await listClients(organizationId, { q, archived });
  return Response.json({ clients });
}
