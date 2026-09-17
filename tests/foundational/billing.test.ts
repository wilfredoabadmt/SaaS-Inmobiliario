import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getPlanConfig, PLANS } from "@/lib/billing/plans";
import { verifyStripeWebhookSignature } from "@/lib/billing/stripe";
import { PlanLimitError } from "@/server/billing/service";

describe("SaaS Billing & Subscriptions (Feature 019)", () => {
  it("valida configuración de planes y límites", () => {
    expect(PLANS.starter.limits.maxProperties).toBe(10);
    expect(PLANS.starter.limits.maxMembers).toBe(2);
    expect(PLANS.starter.limits.voiceNotesTranscription).toBe(false);

    expect(PLANS.pro.limits.maxProperties).toBe(50);
    expect(PLANS.pro.limits.maxMembers).toBe(5);
    expect(PLANS.pro.limits.voiceNotesTranscription).toBe(true);
    expect(PLANS.pro.limits.automatedVisitReminders).toBe(true);

    expect(PLANS.enterprise.limits.maxProperties).toBe(Number.POSITIVE_INFINITY);
    expect(PLANS.enterprise.limits.maxMembers).toBe(Number.POSITIVE_INFINITY);
  });

  it("getPlanConfig degrada de forma segura a starter", () => {
    expect(getPlanConfig(null).id).toBe("starter");
    expect(getPlanConfig(undefined).id).toBe("starter");
    expect(getPlanConfig("unknown_plan").id).toBe("starter");
    expect(getPlanConfig("pro").id).toBe("pro");
    expect(getPlanConfig("enterprise").id).toBe("enterprise");
  });

  it("PlanLimitError estructura correctamente el mensaje y propiedades", () => {
    const err = new PlanLimitError("properties", 10, 10, "starter");
    expect(err.name).toBe("PlanLimitError");
    expect(err.resource).toBe("properties");
    expect(err.limit).toBe(10);
    expect(err.current).toBe(10);
    expect(err.plan).toBe("starter");
    expect(err.message).toContain("STARTER");
  });

  it("verifica firma válida de webhook de Stripe", () => {
    const secret = "whsec_test_secret_key_12345";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
    const signedPayload = `${timestamp}.${payload}`;
    const v1 = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
    const header = `t=${timestamp},v1=${v1}`;

    expect(verifyStripeWebhookSignature(payload, header, secret)).toBe(true);
  });

  it("rechaza firma manipulada o incorrecta de webhook", () => {
    const secret = "whsec_test_secret_key_12345";
    const header = `t=1234567,v1=bad_signature`;
    expect(verifyStripeWebhookSignature("{}", header, secret)).toBe(false);
    expect(verifyStripeWebhookSignature("{}", null, secret)).toBe(false);
  });
});
