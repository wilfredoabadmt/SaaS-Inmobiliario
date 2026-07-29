// Self-test de fichas-tarjeta (feature 006). Login → conversación de prueba → toma un
// propertyId de los matches → POST /ficha → verifica que el saliente quedó como tarjeta
// (kind:"property") en el hilo. El TAP de un botón requiere tocarlo en el teléfono real
// (Evolution no emite button_reply) → verificación humana (instrucciones al final).
// Uso: node --env-file=.env scripts/wa-tester/ficha-card.mjs
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

const { conversations = [] } = await (await api.get(`${BASE}/api/conversations`)).json();
const conv =
  conversations.find((c) => (c.clientPhone || "").replace(/\D/g, "").endsWith(((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))) ||
  conversations[0];
console.log("conversación:", conv.id, "·", conv.clientName);

// Un propertyId de los matches de la conversación (necesita inventario con foto).
const matching = await (await api.get(`${BASE}/api/conversations/${conv.id}/matching`)).json();
const propertyId = matching?.matches?.[0]?.property?.id;
if (!propertyId) {
  console.error("⚠️ No hay matches/propiedades. Siembra inventario (con foto) para la conversación.");
  await browser.close();
  process.exit(1);
}
console.log("propertyId:", propertyId);

const before = (await (await api.get(`${BASE}/api/conversations/${conv.id}/messages`)).json()).messages || [];

const res = await api.post(`${BASE}/api/conversations/${conv.id}/ficha`, { data: { propertyId } });
console.log("POST /ficha:", res.status(), JSON.stringify(await res.json().catch(() => ({}))));

let ok = false;
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(4000);
  const msgs = (await (await api.get(`${BASE}/api/conversations/${conv.id}/messages`)).json()).messages || [];
  const card = msgs.slice(before.length).find((m) => m.direction === "outbound" && (m.kind === "property" || m.property));
  if (card) {
    console.log("✅ Tarjeta registrada en el hilo (kind=property):", card.property?.title);
    ok = true;
    break;
  }
}
if (!ok) console.log("⚠️ No se detectó la tarjeta en el hilo (revisa deploy/migración/foto/logs).");

console.log(`
--- Verificación humana (el tester guardado no puede tocar botones) ---
1) En el teléfono cliente, abre la tarjeta recibida: confirma UNA sola burbuja con FOTO +
   texto (no dos mensajes) y 3 botones (Agendar visita / Hablar con asesor / Más fotos).
2) Toca cada botón:
   - Agendar visita → llega "¿qué día y hora?"; responde una fecha → se crea una visita (/showings).
   - Hablar con asesor → la conversación se marca "Pidió un asesor" (atención humana).
   - Más fotos → llegan hasta 5 fotos (o el aviso si no hay).
3) Sin foto: con una propiedad sin foto, la ficha debe llegar como TEXTO (degradación).
`);

await browser.close();
