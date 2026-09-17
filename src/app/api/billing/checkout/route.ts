import type { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { getEnv, isStripeConfigured } from "@/lib/env";
import {
  getOrganizationSubscription,
  upsertSubscription,
} from "@/server/billing/service";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"]),
});

export async function POST(req: NextRequest) {
  let organizationId: string;
  let userEmail: string;
  try {
    const ctx = await requireOwner();
    organizationId = ctx.organizationId;
    userEmail = ctx.email;
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const json = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid", message: "Plan de suscripción inválido" } },
      { status: 422 },
    );
  }

  const targetPlan = parsed.data.plan;
  const currentSub = await getOrganizationSubscription(organizationId);

  // Cambio a Starter (plan gratuito)
  if (targetPlan === "starter") {
    await upsertSubscription(organizationId, {
      plan: "starter",
      status: "active",
      cancelAtPeriodEnd: false,
    });
    return Response.json({ success: true, plan: "starter" });
  }

  // Si Stripe está configurado, generar sesión de Checkout
  if (isStripeConfigured()) {
    try {
      const env = getEnv();
      const successUrl = `${env.APP_BASE_URL}/settings/billing?session_id={CHECKOUT_SESSION_ID}&success=true`;
      const cancelUrl = `${env.APP_BASE_URL}/settings/billing?canceled=true`;

      const session = await createCheckoutSession({
        organizationId,
        plan: targetPlan,
        userEmail,
        stripeCustomerId: currentSub.stripeCustomerId,
        successUrl,
        cancelUrl,
      });

      return Response.json({ url: session.url });
    } catch (err) {
      console.error("[billing/checkout] Error creando sesión de Stripe:", err);
      return Response.json(
        { error: { code: "stripe_error", message: "No se pudo iniciar el proceso de pago" } },
        { status: 500 },
      );
    }
  }

  // Modo self-hosted / desarrollo: simular actualización inmediata
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await upsertSubscription(organizationId, {
    plan: targetPlan,
    status: "active",
    currentPeriodEnd: thirtyDaysFromNow,
    cancelAtPeriodEnd: false,
  });

  return Response.json({ success: true, simulated: true, plan: targetPlan });
}
