import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await auth.api.getSession({ headers: await headers() });
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? "";
  return <DashboardView firstName={firstName} />;
}
