// @ts-check
/**
 * Verificación DETERMINISTA de la feature 009 simulando el webhook de WhatsApp FIRMADO
 * contra el endpoint en vivo (no depende de la entrega de Meta, no envía WhatsApp real).
 * Ejerce el camino real /api/webhooks/whatsapp → ingest.getOrCreateClient.
 *
 *   1. Inbound de un número NUEVO → contacto auto-creado con channel='whatsapp' (auto-alta).
 *   2. Archivar ese contacto → inbound del mismo número → REACTIVADO (archivedAt null), sin dup.
 *   3. Enriquecimiento: el nombre editado a mano NO se sobrescribe (COALESCE).
 *
 * Uso: PHONE_NUMBER_ID=<id> node --env-file=.env scripts/wa-tester/webhook-sim-009.mjs
 * Requiere en .env: META_APP_SECRET (firma) + TEST_SAAS_URL/EMAIL/PASSWORD (verificación).
 */
import { createHmac } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const SECRET = process.env.META_APP_SECRET;
const PNID = process.env.PHONE_NUMBER_ID;
const TEST_PHONE = process.env.SIM_PHONE || "529990000909"; // número FICTICIO de prueba (no real)

if (!SECRET || !PNID) {
  console.error("❌ Faltan META_APP_SECRET (.env) o PHONE_NUMBER_ID (env). Uso: PHONE_NUMBER_ID=... node --env-file=.env scripts/wa-tester/webhook-sim-009.mjs");
  process.exit(2);
}

let failures = 0;
const log = (...a) => console.log(...a);
function check(name, cond, detail = "") {
  log(`${cond ? "✅" : "❌"} ${name}${detail ? "  —  " + detail : ""}`);
  if (!cond) failures++;
}

/** Construye + firma + postea un inbound de texto al webhook en vivo. */
async function postInbound({ phone, name, body }) {
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
              metadata: { display_phone_number: "test", phone_number_id: PNID },
              contacts: [{ wa_id: phone, profile: name ? { name } : {} }],
              messages: [
                {
                  from: phone,
                  id: `wamid.sim009_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  const res = await fetch(`${BASE}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hub-signature-256": sig },
    body: raw,
  });
  return res;
}

// ---- 1. Auto-alta de un número NUEVO ----
log(`\n— Webhook firmado: auto-alta de número nuevo (${TEST_PHONE}) —`);
let res = await postInbound({ phone: TEST_PHONE, name: "Prospecto Sim 009", body: "Hola (sim 1)" });
check("POST webhook firmado → 200 (firma válida + procesado)", res.status === 200, `status=${res.status}`);
if (res.status === 401) {
  log("  ⚠️ 401 = firma inválida: el META_APP_SECRET local difiere del de Coolify. Ese sería justo el motivo de que los webhooks reales fallen.");
}

// login para verificar via API autenticada
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
const listAll = async () => (await (await api.get(`${BASE}/api/clients?archived=all`)).json())?.clients || [];
const ofPhone = (arr) => arr.filter((c) => (c.phone || "").replace(/\D/g, "").endsWith(TEST_PHONE.slice(-10)));

await page.waitForTimeout(1500);
let rows = ofPhone(await listAll());
check("contacto creado por el webhook", rows.length === 1, `count=${rows.length}`);
check("channel = whatsapp", rows[0]?.channel === "whatsapp", `channel=${rows[0]?.channel}`);
check("nombre desde el perfil", rows[0]?.name === "Prospecto Sim 009", JSON.stringify(rows[0]?.name));
const simId = rows[0]?.id;

// ---- 2. Editar nombre a mano + archivar + reactivar por inbound ----
log(`\n— Enriquecimiento no destructivo + reactivación —`);
if (simId) {
  await api.patch(`${BASE}/api/clients/${simId}`, { data: { name: "Nombre Editado A Mano" } });
  await api.post(`${BASE}/api/clients/${simId}/archive`, { data: { archived: true } });
  let archived = ofPhone(await listAll())[0];
  check("contacto archivado (archivedAt set)", Boolean(archived?.archivedAt), archived?.archivedAt || "");

  // segundo inbound (mismo número) → debe reactivar y NO pisar el nombre editado
  res = await postInbound({ phone: TEST_PHONE, name: "Prospecto Sim 009", body: "Hola otra vez (sim 2)" });
  check("2º POST webhook firmado → 200", res.status === 200, `status=${res.status}`);
  await page.waitForTimeout(1500);

  rows = ofPhone(await listAll());
  check("sin duplicados (sigue 1 fila)", rows.length === 1, `count=${rows.length}`);
  check("REACTIVADO por inbound (archivedAt null)", rows[0] != null && !rows[0].archivedAt);
  check("nombre editado NO se sobrescribió", rows[0]?.name === "Nombre Editado A Mano", JSON.stringify(rows[0]?.name));

  // limpieza: archivar el contacto de prueba (queda fuera de la lista activa)
  await api.post(`${BASE}/api/clients/${simId}/archive`, { data: { archived: true } });
  log("  (limpieza) contacto de prueba archivado.");
}

log(`\n${failures === 0 ? "✅ WEBHOOK-SIM 009: TODO VERDE" : `❌ WEBHOOK-SIM 009: ${failures} fallo(s)`}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
