import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { signContractUploadSchema } from "@/lib/contracts/schemas";
import { listContracts, signContractUpload } from "@/server/contracts/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireMember();
    const { id: candidacyId } = await params;
    const contracts = await listContracts(ctx.organizationId, candidacyId);
    return Response.json({ contracts });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: { message: String(err) } }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireMember();
    const { id: candidacyId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = signContractUploadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { message: "Datos de subida inválidos", details: parsed.error.issues } },
        { status: 400 },
      );
    }

    const result = await signContractUpload(ctx.organizationId, candidacyId, parsed.data);
    return Response.json(result);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: { message: String(err) } }, { status: 400 });
  }
}
