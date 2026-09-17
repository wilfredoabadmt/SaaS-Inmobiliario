import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { getPlanConfig, PLANS } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/env";
import { getOrganizationSubscription, getOrganizationUsage } from "@/server/billing/service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  let organizationId: string;
  let role: string;
  try {
    const ctx = await requireMember();
    organizationId = ctx.organizationId;
    role = ctx.role;
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const [subscription, usage] = await Promise.all([
    getOrganizationSubscription(organizationId),
    getOrganizationUsage(organizationId),
  ]);

  const planConfig = getPlanConfig(subscription.plan);

  return Response.json({
    subscription,
    usage,
    planConfig,
    plans: Object.values(PLANS),
    isStripeConfigured: isStripeConfigured(),
    isOwner: role === "owner",
  });
}
