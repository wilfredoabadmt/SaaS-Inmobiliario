import { requireMember } from "@/lib/auth/guards";
import { CalendarSettingsPanel } from "@/components/showings/calendar-settings-panel";
import { ShowingsList } from "@/components/showings/showings-list";
import { TYPO } from "@/lib/design/typography";
import { listShowings } from "@/server/showings/queries";

export const dynamic = "force-dynamic";

/** Visitas (muestras) reales del tenant + configuración de calendario por asesor (feature 011). */
export default async function ShowingsPage() {
  const { organizationId } = await requireMember();
  const visits = await listShowings(organizationId);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-8 pt-8">
        <h1 className={TYPO.h1}>Visitas</h1>
        <CalendarSettingsPanel />
      </div>
      <ShowingsList visits={visits} embedded />
    </div>
  );
}
