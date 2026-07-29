// Verifica (sin ojos humanos) los dos arreglos: (1) favicon = logo Inmox en el HTML +
// asset alcanzable; (2) la API de matching devuelve `photoUrl` real y la foto se puede
// descargar. Espera a que el build nuevo esté vivo (favicon en el HTML).
// Uso: node --env-file=.env scripts/wa-tester/ui-fixes-check.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("Esperando el build nuevo (favicon inmox-logo.png en el HTML)…");
let live = false;
for (let i = 0; i < 48; i++) {
  try {
    const html = await (await fetch(`${BASE}/`)).text();
    if (html.includes("inmox-logo.png")) {
      console.log(`✅ Favicon en el HTML (build nuevo) — intento ${i + 1}.`);
      live = true;
      break;
    }
  } catch {
    /* red transitoria */
  }
  await sleep(15000);
}
if (!live) {
  console.error("❌ El build nuevo no apareció en ~12 min.");
  process.exit(1);
}

const fav = await fetch(`${BASE}/inmox-logo.png`);
console.log("favicon asset:", fav.status, fav.headers.get("content-type"));

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

const { conversations = [] } = await (await api.get(`${BASE}/api/conversations`)).json();
const conv =
  conversations.find((c) => (c.clientPhone || "").replace(/\D/g, "").endsWith(((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))) ||
  conversations[0];
const matching = await (await api.get(`${BASE}/api/conversations/${conv.id}/matching`)).json();
const withPhoto = (matching.matches || []).filter((m) => m.property?.photoUrl);
console.log(`matches: ${matching.matches?.length || 0} · con photoUrl: ${withPhoto.length}`);
if (withPhoto[0]) {
  const url = withPhoto[0].property.photoUrl;
  const img = await fetch(url);
  console.log("✅ matching trae photoUrl; foto descarga:", img.status, img.headers.get("content-type"));
} else {
  console.log("⚠️ ningún match trae photoUrl (revisa que las propiedades tengan foto / el deploy).");
}
await browser.close();
