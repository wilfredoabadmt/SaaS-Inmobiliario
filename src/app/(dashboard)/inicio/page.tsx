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
 * Maneja resolución defensiva y degradación segura para nunca romper el Server Component.
 */
export default async function DashboardHome() {
  const ctx = await requireMember();

  try {
    const [profile, org, kpis, slaCount, upcomingVisits, recentActivity] = await Promise.all([
      getProfile(ctx.userId).catch(() => null),
      getOrganization(ctx.organizationId).catch(() => null),
      getDashboardKpis(ctx.organizationId).catch(() => []),
      getSlaBreachedCount(ctx.organizationId, 30).catch(() => 0),
      getUpcomingVisits(ctx.organizationId, 5).catch(() => []),
      getRecentActivity(ctx.organizationId, 6).catch(() => []),
    ]);

    const firstName = profile?.name?.trim().split(/\s+/)[0] ?? "";
    const agencyName = org?.name ?? "Mi agencia";

    return (
      <DashboardView
        firstName={firstName}
        agencyName={agencyName}
        kpis={kpis.length > 0 ? kpis : undefined}
        slaCount={slaCount}
        upcomingVisits={upcomingVisits}
        recentActivity={recentActivity}
      />
    );
  } catch (err) {
    console.error("[inicio] Error inesperado cargando datos del dashboard:", err);
    return <DashboardView agencyName="Mi agencia" />;
  }
}
