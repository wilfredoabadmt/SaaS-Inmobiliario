// Verifica de forma decisiva que la foto en R2 ES la imagen IA (mismo byte-length que
// la original de Higgsfield), no un placeholder. Uso: node --env-file=.env scripts/wa-tester/verify-ai-photo.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const AI_POLANCO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3D8QIa39TWOp1eoX6Cbooj2Bndt/hf_20260621_052106_fe2fd70f-b4ec-4630-8649-140d338a0d6e.jpeg";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASS);
await page.click('form button[type="submit"]');
await page.waitForTimeout(6000);
const api = page.request;

const { conversations = [] } = await (await api.get(`${BASE}/api/conversations`)).json();
const conv =
  conversations.find((c) => (c.clientPhone || "").replace(/\D/g, "").endsWith(((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))) ||
  conversations[0];
const matching = await (await api.get(`${BASE}/api/conversations/${conv.id}/matching`)).json();
const polanco = (matching.matches || []).find((m) =>
  (m.property?.title || "").toLowerCase().includes("polanco"),
);
if (!polanco?.property?.photoUrl) {
  console.error("❌ No encontré photoUrl de Polanco");
  await browser.close();
  process.exit(1);
}

const r2buf = await (await fetch(polanco.property.photoUrl)).arrayBuffer();
const aibuf = await (await fetch(AI_POLANCO)).arrayBuffer();
console.log(`Polanco — R2: ${r2buf.byteLength} bytes · IA original: ${aibuf.byteLength} bytes`);
if (r2buf.byteLength === aibuf.byteLength) {
  console.log("✅ DECISIVO: la foto de R2 es la imagen generada con IA (Nano Banana).");
} else {
  console.log("⚠️ NO coinciden — R2 tiene otra imagen (¿build viejo aún vivo? re-ejecuta tras el deploy).");
}
await browser.close();
