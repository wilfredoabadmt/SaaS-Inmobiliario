import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { deleteCandidateDoc } from "@/server/documents/service";

interface RouteContext {
  params: Promise<{ id: string; docId: string }>;
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireMember();
    const { id: candidacyId, docId } = await params;
    await deleteCandidateDoc(ctx.organizationId, candidacyId, docId);
    return Response.json({ success: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: { message: String(err) } }, { status: 400 });
  }
}
