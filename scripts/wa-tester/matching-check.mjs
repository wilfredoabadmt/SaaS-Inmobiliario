// Verifica el matching (US1) en inmox-dev: login owner → siembra inventario →
// fija requisitos del cliente de prueba → lee el ranking. Detecta si el token de
// OpenRouter ya está puesto (campo `why` con explicación = IA activa).
// Uso: node --env-file=.env scripts/wa-tester/matching-check.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
if (!EMAIL || !PASS) {
  console.error("Faltan TEST_SAAS_EMAIL / TEST_SAAS_PASSWORD");
  process.exit(1);
}

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
console.log("✅ Login OK");

const api = page.request;

// 1) Sembrar inventario de prueba
const seed = await api.post(`${BASE}/api/dev/seed-properties`);
console.log("seed-properties:", seed.status(), JSON.stringify(await seed.json().catch(() => ({}))));

// 2) Conversación de prueba
const convRes = await api.get(`${BASE}/api/conversations`);
const { conversations = [] } = await convRes.json().catch(() => ({ conversations: [] }));
console.log(`conversaciones: ${conversations.length}`);
const conv =
  conversations.find((c) => (c.clientPhone || "").replace(/\D/g, "").endsWith(((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))) ||
  conversations[0];
if (!conv) {
  console.error("❌ No hay conversaciones para probar (manda un WhatsApp al número de prueba primero).");
  await browser.close();
  process.exit(3);
}
console.log("conversación:", conv.id, "·", conv.clientName, conv.clientPhone);

// 3) Fijar requisitos (cliente busca: renta, Polanco, 2 rec, hasta 28k)
const putReq = await api.put(`${BASE}/api/conversations/${conv.id}/requirements`, {
  data: { operation: "renta", zone: "Polanco", propertyType: "departamento", bedrooms: 2, budgetMax: 28000 },
});
console.log("PUT requirements:", putReq.status(), JSON.stringify(await putReq.json().catch(() => ({}))));

// 4) Leer el matching
const matchRes = await api.get(`${BASE}/api/conversations/${conv.id}/matching`);
const data = await matchRes.json().catch(() => ({}));
console.log("\n— MATCHING —", matchRes.status());
console.log("requisitos:", JSON.stringify(data.requirements));
const matches = data.matches || [];
let aiActive = false;
matches.forEach((m, i) => {
  if (m.why) aiActive = true;
  console.log(`  #${i + 1} ${m.property?.title} — ${m.pct}%  ${m.why ? "· " + m.why : "(sin explicación IA)"}`);
});
console.log(`\nTop match: ${matches[0]?.property?.title ?? "—"} (${matches[0]?.pct ?? "—"}%)`);
console.log(`OpenRouter en prod: ${aiActive ? "✅ ACTIVO (hay explicaciones IA)" : "⚠️ aún OFF (ranking determinista; falta el token o no respondió)"}`);

await browser.close();
