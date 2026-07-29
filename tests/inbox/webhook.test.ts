import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/lib/meta";

/**
 * Verificación de firma del webhook (Principio I/IV). La idempotencia por
 * `wa_message_id` (UNIQUE + onConflictDoNothing) se valida contra Postgres real
 * (pendiente de verificación humana — ver reporte).
 */
const secret = "test_app_secret";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("acepta una firma válida", () => {
    expect(verifyWebhookSignature(body, sign(body), secret)).toBe(true);
  });

  it("rechaza una firma inválida", () => {
    expect(verifyWebhookSignature(body, "sha256=deadbeef", secret)).toBe(false);
  });

  it("rechaza si el cuerpo fue manipulado", () => {
    expect(verifyWebhookSignature(body + "tampered", sign(body), secret)).toBe(false);
  });

  it("rechaza cuando falta el header de firma", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });
});
