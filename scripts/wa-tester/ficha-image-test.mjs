// Self-test de la RUTA DE IMAGEN de la ficha-tarjeta (feature 006). Lo corre el agente
// para autocorregirse: espera el deploy nuevo, siembra una foto real (R2), envía la
// ficha y reporta si Meta aceptó la imagen por `link` (201) o la rechazó (502).
// Uso: node --env-file=.env scripts/wa-tester/ficha-image-test.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) Esperar a que el build con /api/dev/seed-photo esté vivo (404 = build viejo).
console.log("Esperando el deploy nuevo (ruta /api/dev/seed-photo)…");
let live = false;
for (let i = 0; i < 48; i++) {
  try {
    const r = await fetch(`${BASE}/api/dev/seed-photo`, { method: "POST" });
    if (r.status !== 404) {
      console.log(`Build nuevo vivo (status ${r.status}) en intento ${i + 1}.`);
      live = true;
      break;
    }
  } catch {
    /* red transitoria */
  }
  await sleep(15000);
}
if (!live) {
  console.error("❌ El build nuevo no apareció en ~12 min (timeout).");
  process.exit(1);
}

// 2) Login.
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

// 3) Sembrar foto real en las propiedades sin foto.
const seedRes = await api.post(`${BASE}/api/dev/seed-photo`);
console.log("seed-photo:", seedRes.status(), JSON.stringify(await seedRes.json().catch(() => ({}))));

// 4) Conversación de prueba + un propertyId de los matches.
const { conversations = [] } = await (await api.get(`${BASE}/api/conversations`)).json();
const conv =
  conversations.find((c) => (c.clientPhone || "").replace(/\D/g, "").endsWith(((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))) ||
  conversations[0];
const matching = await (await api.get(`${BASE}/api/conversations/${conv.id}/matching`)).json();
const propertyId = matching?.matches?.[0]?.property?.id;
console.log("conv:", conv.id, "· propertyId:", propertyId);
if (!propertyId) {
  console.error("⚠️ Sin matches en la conversación; no puedo elegir propiedad.");
  await browser.close();
  process.exit(3);
}

// 5) Enviar la ficha → señal definitiva.
const res = await api.post(`${BASE}/api/conversations/${conv.id}/ficha`, { data: { propertyId } });
const body = await res.json().catch(() => ({}));
console.log("POST /ficha:", res.status(), JSON.stringify(body));
if (res.status() === 201) {
  console.log("✅ Meta ACEPTÓ la tarjeta con imagen (header por `link` funciona). Revisa el teléfono: debe llegar con FOTO.");
} else if (res.status() === 502) {
  console.log(`❌ Meta RECHAZÓ la tarjeta: ${body?.error?.message}. → Hay que cambiar el header de imagen a media-id (subir a Meta).`);
} else {
  console.log(`⚠️ Respuesta inesperada (${res.status()}): ${JSON.stringify(body)}`);
}
await browser.close();
