// Diagnóstico de envío saliente vía WhatsApp Cloud API (mismo camino que la bandeja).
// Lee el token de .env (META_SYSTEM_USER_TOKEN). NO imprime el token.
// Uso: TEST_PHONE_NUMBER_ID=... RECIPIENT=52... node --env-file=.env scripts/wa-tester/send-test.mjs
const V = process.env.META_GRAPH_API_VERSION || "v21.0";
const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const PNID = process.env.TEST_PHONE_NUMBER_ID;
const TO = process.env.RECIPIENT;
const TEXT = process.env.TEXT || "Prueba de envío de Inmox ✅ (diagnóstico automático)";

if (!TOKEN || !PNID || !TO) {
  console.error("Faltan META_SYSTEM_USER_TOKEN / TEST_PHONE_NUMBER_ID / RECIPIENT");
  process.exit(1);
}

const base = `https://graph.facebook.com/${V}`;
const auth = { Authorization: `Bearer ${TOKEN}` };

// 1) Estado del número (read-only).
{
  const res = await fetch(
    `${base}/${PNID}?fields=display_phone_number,verified_name,code_verification_status,platform_type,name_status,quality_rating,throughput,account_mode`,
    { headers: auth },
  );
  const body = await res.json().catch(() => ({}));
  console.log("— Estado del número —", res.status);
  console.log(JSON.stringify(body, null, 2));
}

// 2) Intento de envío real.
{
  const res = await fetch(`${base}/${PNID}/messages`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: TO, type: "text", text: { body: TEXT } }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`\n— Envío a ${TO} —`, res.status, res.ok ? "OK ✅" : "RECHAZADO ❌");
  console.log(JSON.stringify(body, null, 2));
}
