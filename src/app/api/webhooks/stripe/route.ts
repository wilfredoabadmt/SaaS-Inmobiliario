import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { subscription } from "@/lib/db/schema/domain";
import { verifyStripeWebhookSignature } from "@/lib/billing/stripe";
import { getEnv } from "@/lib/env";
import { upsertSubscription } from "@/server/billing/service";
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const env = getEnv();
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (env.STRIPE_WEBHOOK_SECRET) {
    const isValid = verifyStripeWebhookSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.warn("[webhooks/stripe] Firma de webhook inválida");
      return Response.json({ error: "Firma inválida" }, { status: 400 });
    }
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const db = getDb();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data?.object;
        const organizationId = session?.metadata?.organizationId;
        const plan = (session?.metadata?.plan as SubscriptionPlan) ?? "pro";
        const customerId = session?.customer;
        const subscriptionId = session?.subscription;

        if (organizationId) {
          await upsertSubscription(organizationId, {
            plan,
            status: "active",
            stripeCustomerId: customerId ? String(customerId) : null,
            stripeSubscriptionId: subscriptionId ? String(subscriptionId) : null,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            cancelAtPeriodEnd: false,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data?.object;
        const subscriptionId = sub?.id;
        const customerId = sub?.customer;
        const rawStatus = sub?.status;
        const currentPeriodEnd = sub?.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null;
        const cancelAtPeriodEnd = Boolean(sub?.cancel_at_period_end);

        let status: SubscriptionStatus = "active";
        if (rawStatus === "past_due") status = "past_due";
        else if (rawStatus === "canceled" || rawStatus === "unpaid") status = "canceled";
        else if (rawStatus === "trialing") status = "trialing";

        // Localizar por stripeSubscriptionId o stripeCustomerId
        if (subscriptionId) {
          const rows = await db
            .select({ organizationId: subscription.organizationId })
            .from(subscription)
            .where(eq(subscription.stripeSubscriptionId, subscriptionId))
            .limit(1);

          const orgId = rows[0]?.organizationId;
          if (orgId) {
            await upsertSubscription(orgId, {
              status,
              currentPeriodEnd,
              cancelAtPeriodEnd,
              stripeCustomerId: customerId ? String(customerId) : undefined,
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data?.object;
        const subscriptionId = sub?.id;

        if (subscriptionId) {
          const rows = await db
            .select({ organizationId: subscription.organizationId })
            .from(subscription)
            .where(eq(subscription.stripeSubscriptionId, subscriptionId))
            .limit(1);

          const orgId = rows[0]?.organizationId;
          if (orgId) {
            await upsertSubscription(orgId, {
              plan: "starter",
              status: "canceled",
              cancelAtPeriodEnd: false,
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data?.object;
        const subscriptionId = invoice?.subscription;

        if (subscriptionId) {
          const rows = await db
            .select({ organizationId: subscription.organizationId })
            .from(subscription)
            .where(eq(subscription.stripeSubscriptionId, subscriptionId))
            .limit(1);

          const orgId = rows[0]?.organizationId;
          if (orgId) {
            await upsertSubscription(orgId, {
              status: "past_due",
            });
          }
        }
        break;
      }

      default:
        // Evento ignorado
        break;
    }
  } catch (err) {
    console.error(`[webhooks/stripe] Error procesando evento ${event.type}:`, err);
  }

  return Response.json({ received: true });
}
