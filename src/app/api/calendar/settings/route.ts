import type { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { CalendarSettingsError, getSettings, upsertSettings } from "@/server/calendar/settings";

export const dynamic = "force-dynamic";

const intervalSchema = z.object({ start: z.string(), end: z.string() });
const putSchema = z.object({
  weeklyHours: z.record(z.string(), z.array(intervalSchema)),
  slotMinutes: z.number(),
  bufferMinutes: z.number(),
  timezone: z.string().min(1),
});

/** GET /api/calendar/settings — configuración del asesor actual (o default virtual). */
export async function GET() {
  let userId: string, organizationId: string;
  try {
    ({ userId, organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const settings = await getSettings(organizationId, userId);
  return Response.json(settings);
}

/** PUT /api/calendar/settings — upsert de la configuración del asesor actual. */
export async function PUT(req: NextRequest) {
  let userId: string, organizationId: string;
  try {
    ({ userId, organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid_settings", message: "Configuración inválida", issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  try {
    await upsertSettings(organizationId, userId, parsed.data);
  } catch (e) {
    if (e instanceof CalendarSettingsError) {
      return Response.json({ error: { code: "invalid_settings", message: e.message } }, { status: 400 });
    }
    throw e;
  }
  return Response.json({ ok: true });
}
