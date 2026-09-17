import type { KpiData, UpcomingVisit, ActivityItem } from "@/lib/design/sample-data";

export type { KpiData, UpcomingVisit, ActivityItem };

export interface DashboardData {
  firstName: string;
  kpis: KpiData[];
  slaCount: number;
  upcomingVisits: UpcomingVisit[];
  recentActivity: ActivityItem[];
}
