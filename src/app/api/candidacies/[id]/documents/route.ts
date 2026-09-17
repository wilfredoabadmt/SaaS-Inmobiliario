import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { signDocUploadSchema } from "@/lib/documents/schemas";
import { listCandidateDocs, signCandidateDocUpload } from "@/server/documents/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireMember();
    const { id: candidacyId } = await params;
    const docs = await listCandidateDocs(ctx.organizationId, candidacyId);
    return Response.json({ documents: docs });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: { message: String(err) } }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireMember();
    const { id: candidacyId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = signDocUploadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { message: "Datos de subida inválidos", details: parsed.error.issues } },
        { status: 400 },
      );
    }

    const result = await signCandidateDocUpload(ctx.organizationId, candidacyId, parsed.data);
    return Response.json(result);
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: { message: String(err) } }, { status: 400 });
  }
}
