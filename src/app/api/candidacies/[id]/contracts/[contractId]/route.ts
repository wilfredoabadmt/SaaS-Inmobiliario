import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { updateContractStatusSchema } from "@/lib/contracts/schemas";
import { deleteContract, updateContractStatus } from "@/server/contracts/service";

interface RouteContext {
  params: Promise<{ id: string; contractId: string }>;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireMember();
    const { contractId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = updateContractStatusSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { message: "Estado de contrato inválido", details: parsed.error.issues } },
        { status: 400 },
      );
    }

    await updateContractStatus(ctx.organizationId, contractId, parsed.data.status);
    return Response.json({ success: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: { message: String(err) } }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireMember();
    const { contractId } = await params;
    await deleteContract(ctx.organizationId, contractId);
    return Response.json({ success: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: { message: String(err) } }, { status: 400 });
  }
}
