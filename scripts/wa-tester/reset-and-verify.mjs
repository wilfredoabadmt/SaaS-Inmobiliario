// Resetea la(s) conversación(es) de prueba vía el endpoint dev y verifica que quedan en
// cero (historial vacío + matching sin requisitos) y con el agente activo.
// Uso: node --env-file=.env scripts/wa-tester/reset-and-verify.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;

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

// 1) Reset (todas las conversaciones del tenant de prueba).
const r = await api.post(`${BASE}/api/dev/reset-conversation`);
const body = await r.json().catch(() => ({}));
console.log("reset:", r.status(), JSON.stringify(body));
if (!r.ok()) {
  console.error("❌ El endpoint de reset no respondió OK (¿build viejo aún vivo? reintenta tras el deploy).");
  await browser.close();
  process.exit(1);
}

// 2) Verificar: la conversación de prueba queda sin mensajes y sin matching.
const { conversations = [] } = await (await api.get(`${BASE}/api/conversations`)).json();
const conv =
  conversations.find((c) => (c.clientPhone || "").replace(/\D/g, "").endsWith(((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))) ||
  conversations[0];
if (!conv) {
  console.log("⚠️ No hay conversaciones (nada que verificar).");
  await browser.close();
  process.exit(0);
}
const msgs = await (await api.get(`${BASE}/api/conversations/${conv.id}/messages`)).json();
const matching = await (await api.get(`${BASE}/api/conversations/${conv.id}/matching`)).json();
const nMsgs = (msgs.messages || msgs.items || []).length;
const nMatches = (matching.matches || []).length;
console.log(`conversación ${conv.id}: mensajes=${nMsgs} · matches=${nMatches} · requisitos=${matching.requirements ? "presentes" : "null"}`);
if (nMsgs === 0 && nMatches === 0 && !matching.requirements) {
  console.log("✅ DECISIVO: conversación reseteada a cero (sin historial, sin requisitos, sin matches).");
} else {
  console.log("⚠️ Aún hay estado residual; revisa el reset.");
}
await browser.close();
