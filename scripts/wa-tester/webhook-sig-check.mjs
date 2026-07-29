// @ts-check
/**
 * Diagnóstico de firma del webhook (cero dependencias: sin BD, sin WhatsApp, sin phone_number_id).
 * Postea un payload FIRMADO con el META_APP_SECRET local + un phone_number_id bogus. La firma se
 * verifica ANTES de resolver el número, así que:
 *   - 200 → mi META_APP_SECRET local COINCIDE con el de Coolify (firma válida; nº no mapeado → ack+descarta).
 *   - 401 → mi META_APP_SECRET local NO coincide con el de Coolify (posible causa de que los webhooks reales fallen).
 *
 * Uso: node --env-file=.env scripts/wa-tester/webhook-sig-check.mjs
 */
import { createHmac } from "node:crypto";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const SECRET = process.env.META_APP_SECRET;
if (!SECRET) {
  console.error("❌ Falta META_APP_SECRET en .env");
  process.exit(2);
}

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA_TEST",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "000_bogus_pnid_000" },
            messages: [],
          },
        },
      ],
    },
  ],
};
const raw = JSON.stringify(payload);
const goodSig = "sha256=" + createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");

let res = await fetch(`${BASE}/api/webhooks/whatsapp`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-hub-signature-256": goodSig },
  body: raw,
});
const verdict =
  res.status === 200
    ? "✅ secreto COINCIDE con Coolify (firma válida; el nº bogus se descarta con ack)"
    : res.status === 401
      ? "❌ secreto NO coincide con Coolify (firma rechazada)"
      : `⚠️ status inesperado`;
console.log(`firma con META_APP_SECRET local → ${res.status}  ${verdict}`);

// Control: firma inválida debe dar 401.
res = await fetch(`${BASE}/api/webhooks/whatsapp`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-hub-signature-256": "sha256=deadbeef" },
  body: raw,
});
console.log(`control firma inválida → ${res.status}  ${res.status === 401 ? "✅ (correcto)" : "⚠️ (debería ser 401)"}`);
