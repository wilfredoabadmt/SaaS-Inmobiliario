import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { confirmDocUploadSchema } from "@/lib/documents/schemas";
import { confirmCandidateDoc } from "@/server/documents/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireMember();
    const { id: candidacyId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = confirmDocUploadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { message: "Datos de confirmación inválidos", details: parsed.error.issues } },
        { status: 400 },
      );
    }

    await confirmCandidateDoc(ctx.organizationId, candidacyId, ctx.userId, parsed.data);
    return Response.json({ success: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: { message: String(err) } }, { status: 400 });
  }
}
