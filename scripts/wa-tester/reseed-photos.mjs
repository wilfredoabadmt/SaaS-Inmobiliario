// Re-siembra las fotos de propiedad con imágenes de bienes raíces (reemplaza las random)
// y verifica que la API de matching las sirva. Espera el build nuevo: el endpoint nuevo
// REEMPLAZA fotos (devuelve seeded>0), el viejo las saltaba (seeded:0).
// Uso: node --env-file=.env scripts/wa-tester/reseed-photos.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

console.log("Esperando el build nuevo (seed-photo que REEMPLAZA → seeded>0)…");
let seeded = 0;
for (let i = 0; i < 48; i++) {
  const r = await api.post(`${BASE}/api/dev/seed-photo`);
  const body = await r.json().catch(() => ({}));
  console.log(`intento ${i + 1}:`, r.status(), JSON.stringify(body));
  if (r.ok() && (body.seeded ?? 0) > 0) {
    seeded = body.seeded;
    break;
  }
  await sleep(15000);
}
if (!seeded) {
  console.error("❌ El endpoint nuevo (replace) no sembró fotos.");
  await browser.close();
  process.exit(1);
}
console.log(`✅ Re-sembradas ${seeded} fotos de bienes raíces (reemplazaron las random).`);

// Verificar que el matching las sirve y descargan.
const { conversations = [] } = await (await api.get(`${BASE}/api/conversations`)).json();
const conv =
  conversations.find((c) => (c.clientPhone || "").replace(/\D/g, "").endsWith(((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))) ||
  conversations[0];
const matching = await (await api.get(`${BASE}/api/conversations/${conv.id}/matching`)).json();
const withPhoto = (matching.matches || []).filter((m) => m.property?.photoUrl);
console.log(`matches con photoUrl: ${withPhoto.length}/${matching.matches?.length || 0}`);
if (withPhoto[0]) {
  const img = await fetch(withPhoto[0].property.photoUrl);
  console.log("foto descarga:", img.status, img.headers.get("content-type"));
}
console.log("→ Confirma en la bandeja que ahora las fotos SÍ parecen propiedades.");
await browser.close();
