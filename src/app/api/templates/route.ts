import { z } from "zod";
import { authErrorResponse, requireMember, requireOwner } from "@/lib/auth/guards";
import { templateComponentsSchema } from "@/lib/meta/templates";
import {
  createTemplate,
  listTemplatesWithStatus,
  templateErrorPayload,
} from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

/** GET /api/templates — plantillas de la agencia con su estatus real (FR-001, feature 012). */
export async function GET() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const templates = await listTemplatesWithStatus(organizationId);
  return Response.json({ templates });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  waTemplateName: z
    .string()
    .regex(/^[a-z0-9_]{1,512}$/, "Usa minúsculas, números y guion bajo (snake_case)."),
  language: z.string().min(2).max(15),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  components: templateComponentsSchema,
  headerHandle: z.string().optional(),
});

/** POST /api/templates — crea una plantilla y la envía a revisión de Meta (FR-002/003, owner). */
export async function POST(req: Request) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Plantilla inválida";
    return Response.json({ error: { code: "invalid", message } }, { status: 422 });
  }

  try {
    const { id, status } = await createTemplate(organizationId, parsed.data);
    return Response.json({ id, status }, { status: 201 });
  } catch (e) {
    const { status, body } = templateErrorPayload(e);
    return Response.json(body, { status });
  }
}
