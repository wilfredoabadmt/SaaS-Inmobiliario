// Self-test del agente de IA (feature 004): activa el agente en la conversación de
// prueba, escribe como cliente vía Evolution (personal → número de prueba) y verifica
// que el agente responde (mensaje saliente ai_generated). Usa el guardrail/allowlist.
// Uso: node --env-file=.env scripts/wa-tester/agent-roundtrip.mjs
import { chromium } from "@playwright/test";
import { sendText, confirmAccess } from "./evolution-client.mjs";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const PLATFORM = (process.env.PLATFORM_TEST_NUMBER || "0000000000"); // número de prueba de la plataforma (+1 555-176-8947)

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASS);
await page.click('form button[type="submit"]');
await page.waitForTimeout(6000);
if (page.url().includes("/login")) {
  console.error("❌ Login falló");
  await browser.close();
  process.exit(2);
}
const api = page.request;

// Conversación de prueba
const { conversations = [] } = await (await api.get(`${BASE}/api/conversations`)).json();
const conv =
  conversations.find((c) => (c.clientPhone || "").replace(/\D/g, "").endsWith(((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))) ||
  conversations[0];
console.log("conversación:", conv.id, "·", conv.clientName);

// Activar agente + limpiar handoff
const ag = await api.post(`${BASE}/api/conversations/${conv.id}/agent`, { data: { resume: true } });
console.log("agente:", ag.status(), JSON.stringify(await ag.json().catch(() => ({}))));

// Mensajes antes
const before = (await (await api.get(`${BASE}/api/conversations/${conv.id}/messages`)).json()).messages || [];
console.log("mensajes antes:", before.length);

// Confirmar acceso Evolution + enviar como cliente
console.log("evolution:", JSON.stringify(await confirmAccess()));
const texto =
  process.argv[2] ||
  "Hola, busco departamento en renta en Polanco, 2 recámaras, hasta 28 mil al mes. ¿Tienes algo?";
console.log("→ (cliente) envío:", texto);
await sendText(PLATFORM, texto);

// Esperar webhook + agente (after) + OpenRouter + envío
console.log("esperando respuesta del agente…");
let reply = null;
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(6000);
  const msgs = (await (await api.get(`${BASE}/api/conversations/${conv.id}/messages`)).json()).messages || [];
  const newOut = msgs
    .slice(before.length)
    .filter((m) => m.direction === "outbound" && m.aiGenerated);
  if (newOut.length) {
    reply = newOut;
    break;
  }
  process.stdout.write(`  …${(i + 1) * 6}s\n`);
}

if (reply) {
  console.log("\n✅ EL AGENTE RESPONDIÓ (ai_generated):");
  reply.forEach((m) => console.log("  🤖", m.body));
} else {
  console.log("\n⚠️ No se detectó respuesta del agente en ~72s (revisar logs de prod).");
}

// Estado final del agente (para verificar handoff)
const after = (await (await api.get(`${BASE}/api/conversations`)).json()).conversations || [];
const c2 = after.find((c) => c.id === conv.id);
console.log(`\nestado conversación → aiEnabled=${c2?.aiEnabled} needsHuman=${c2?.needsHuman}`);

await browser.close();
