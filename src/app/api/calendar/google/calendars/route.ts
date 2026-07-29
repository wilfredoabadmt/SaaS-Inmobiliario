import type { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getStatusView, listUserCalendars, saveCalendarSelection } from "@/server/calendar/google";

export const dynamic = "force-dynamic";

/** GET — lista los calendarios del asesor + su selección actual (destino + conflictos). */
export async function GET() {
  let userId: string, organizationId: string;
  try {
    ({ userId, organizationId } = await requireMember());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
  const calendars = await listUserCalendars(organizationId, userId);
  if (calendars === null) {
    return Response.json(
      { error: { code: "not_connected", message: "Google no conectado o requiere reconexión" } },
      { status: 409 },
    );
  }
  const status = await getStatusView(organizationId, userId);
  const targetCalendarId = status.calendarId ?? "primary";
  const conflictCalendarIds = status.conflictCalendarIds ?? [targetCalendarId];
  return Response.json({ calendars, targetCalendarId, conflictCalendarIds });
}

const putSchema = z.object({
  targetCalendarId: z.string().min(1),
  conflictCalendarIds: z.array(z.string().min(1)),
});

/** PUT — guarda el calendario destino y los calendarios que cuentan para conflictos. */
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
    return Response.json({ error: { code: "invalid", message: "Selección inválida" } }, { status: 400 });
  }
  await saveCalendarSelection(organizationId, userId, parsed.data);
  return Response.json({ ok: true });
}
