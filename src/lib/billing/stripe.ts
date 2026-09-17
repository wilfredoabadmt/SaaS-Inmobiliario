import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv, isStripeConfigured } from "@/lib/env";
import { PLANS, type SubscriptionPlan } from "@/lib/billing/plans";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

/**
 * Petición autenticada a la API de Stripe usando fetch estándar (sin dependencias pesadas).
 */
async function stripeRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: Record<string, string>,
): Promise<T> {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY no está configurada");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const init: RequestInit = {
    method,
    headers,
  };

  if (body && method !== "GET") {
    init.body = new URLSearchParams(body).toString();
  }

  const res = await fetch(`${STRIPE_API_BASE}/${path}`, init);
  const data = (await res.json()) as any;

  if (!res.ok) {
    const message = data?.error?.message ?? `Error en la API de Stripe (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

/**
 * Genera una sesión de Stripe Checkout para suscripción.
 */
export async function createCheckoutSession(opts: {
  organizationId: string;
  plan: SubscriptionPlan;
  userEmail: string;
  stripeCustomerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const env = getEnv();
  const planConfig = PLANS[opts.plan];
  const priceId =
    opts.plan === "pro"
      ? env.STRIPE_PRO_PRICE_ID
      : opts.plan === "enterprise"
        ? env.STRIPE_ENTERPRISE_PRICE_ID
        : undefined;

  const params: Record<string, string> = {
    mode: "subscription",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "metadata[organizationId]": opts.organizationId,
    "metadata[plan]": opts.plan,
    "subscription_data[metadata][organizationId]": opts.organizationId,
    "subscription_data[metadata][plan]": opts.plan,
  };

  if (opts.stripeCustomerId) {
    params.customer = opts.stripeCustomerId;
  } else {
    params.customer_email = opts.userEmail;
  }

  if (priceId) {
    params["line_items[0][price]"] = priceId;
    params["line_items[0][quantity]"] = "1";
  } else {
    // Si no hay priceId definido en variables de entorno, creamos el item ad-hoc
    params["line_items[0][price_data][currency]"] = "mxn";
    params["line_items[0][price_data][product_data][name]"] = `Homya Plan ${planConfig.name}`;
    params["line_items[0][price_data][product_data][description]"] = planConfig.description;
    params["line_items[0][price_data][unit_amount]"] = String(planConfig.monthlyPriceMxn * 100);
    params["line_items[0][price_data][recurring][interval]"] = "month";
    params["line_items[0][quantity]"] = "1";
  }

  const session = await stripeRequest<{ id: string; url: string }>("checkout/sessions", "POST", params);
  return { url: session.url, sessionId: session.id };
}

/**
 * Genera un enlace al Stripe Customer Portal para gestionar la suscripción existente.
 */
export async function createPortalSession(opts: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const params: Record<string, string> = {
    customer: opts.stripeCustomerId,
    return_url: opts.returnUrl,
  };

  const session = await stripeRequest<{ url: string }>("billing_portal/sessions", "POST", params);
  return { url: session.url };
}

/**
 * Verifica la firma de un webhook de Stripe (`Stripe-Signature`).
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string = getEnv().STRIPE_WEBHOOK_SECRET,
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  const parts = signatureHeader.split(",");
  let timestamp = "";
  let v1Sig = "";

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") v1Sig = value;
  }

  if (!timestamp || !v1Sig) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", webhookSecret).update(signedPayload, "utf8").digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(v1Sig);

  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
