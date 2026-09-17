import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { confirmContractUploadSchema } from "@/lib/contracts/schemas";
import { confirmContract } from "@/server/contracts/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireMember();
    const { id: candidacyId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = confirmContractUploadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { message: "Datos de confirmación inválidos", details: parsed.error.issues } },
        { status: 400 },
      );
    }

    await confirmContract(ctx.organizationId, candidacyId, ctx.userId, parsed.data);
    return Response.json({ success: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: { message: String(err) } }, { status: 400 });
  }
}
