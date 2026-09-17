import type { NextRequest } from "next/server";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { createPortalSession } from "@/lib/billing/stripe";
import { getEnv, isStripeConfigured } from "@/lib/env";
import { getOrganizationSubscription } from "@/server/billing/service";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  let organizationId: string;
  try {
    const ctx = await requireOwner();
    organizationId = ctx.organizationId;
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const sub = await getOrganizationSubscription(organizationId);

  if (isStripeConfigured() && sub.stripeCustomerId) {
    try {
      const env = getEnv();
      const returnUrl = `${env.APP_BASE_URL}/settings/billing`;
      const session = await createPortalSession({
        stripeCustomerId: sub.stripeCustomerId,
        returnUrl,
      });
      return Response.json({ url: session.url });
    } catch (err) {
      console.error("[billing/portal] Error creando sesión de portal:", err);
      return Response.json(
        { error: { code: "portal_error", message: "No se pudo abrir el portal de facturación" } },
        { status: 500 },
      );
    }
  }

  return Response.json({ url: "/settings/billing" });
}
