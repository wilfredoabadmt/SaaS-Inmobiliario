import { requireMember } from "@/lib/auth/guards";
import { getProfile } from "@/server/account/profile";
import { getOrganization } from "@/server/organization/settings";
import {
  getDashboardKpis,
  getRecentActivity,
  getSlaBreachedCount,
  getUpcomingVisits,
} from "@/server/dashboard/queries";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const dynamic = "force-dynamic";

/**
 * Pantalla de inicio del CRM con métricas, KPIs, SLA y visitas 100% reales (Feature 014).
 */
export default async function DashboardHome() {
  const ctx = await requireMember();

  const [profile, org, kpis, slaCount, upcomingVisits, recentActivity] = await Promise.all([
    getProfile(ctx.userId),
    getOrganization(ctx.organizationId),
    getDashboardKpis(ctx.organizationId),
    getSlaBreachedCount(ctx.organizationId, 30),
    getUpcomingVisits(ctx.organizationId, 5),
    getRecentActivity(ctx.organizationId, 6),
  ]);

  const firstName = profile?.name?.trim().split(/\s+/)[0] ?? "";
  const agencyName = org?.name ?? "Mi agencia";

  return (
    <DashboardView
      firstName={firstName}
      agencyName={agencyName}
      kpis={kpis}
      slaCount={slaCount}
      upcomingVisits={upcomingVisits}
      recentActivity={recentActivity}
    />
  );
}
