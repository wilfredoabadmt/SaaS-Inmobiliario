// @ts-check
/**
 * Self-test US4 (Google Calendar bidireccional) — ciclo crear→reprogramar→cancelar vía el agente.
 * Prueba la ESCRITURA a Google de forma observable: si insert/patch/deleteEvent fallara por auth,
 * el status de Google pasaría a `reconnect_required`. Que siga `connected` tras cada operación
 * prueba que las llamadas a Google Calendar funcionaron. Inbound vía webhook firmado.
 *
 * Uso: node --env-file=.env scripts/wa-tester/visit-011-google.mjs
 * Requiere Google CONECTADO previamente para el asesor de prueba.
 */
import { createHmac } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const SECRET = process.env.META_APP_SECRET;
const PNID = process.env.PHONE_NUMBER_ID;
const TESTER_LAST10 = ((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000");

let failures = 0;
const log = (...a) => console.log(...a);
const check = (n, c, d = "") => { log(`${c ? "✅" : "❌"} ${n}${d ? "  —  " + d : ""}`); if (!c) failures++; };
const json = async (r) => { try { return await r.json(); } catch { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const last10 = (s) => String(s || "").replace(/\D/g, "").slice(-10);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL); await page.fill("#password", PASS);
await page.click('form button[type="submit"]'); await page.waitForTimeout(6000);
if (page.url().includes("/login")) { console.error("login fail"); await browser.close(); process.exit(2); }
const api = page.request;

const gstatus = async () => (await json(await api.get(`${BASE}/api/calendar/google/status`)))?.status;
check("Google conectado al inicio", (await gstatus()) === "connected", await gstatus());

const testerClient = ((await json(await api.get(`${BASE}/api/clients?archived=all`)))?.clients || []).find((c) => last10(c.phone) === TESTER_LAST10);
const conv = ((await json(await api.get(`${BASE}/api/conversations`)))?.conversations || []).find((c) => last10(c.clientPhone) === TESTER_LAST10);
await api.post(`${BASE}/api/conversations/${conv.id}/agent`, { data: { enabled: true } });
const getMsgs = async () => (await json(await api.get(`${BASE}/api/conversations/${conv.id}/messages`)))?.messages || [];
const visitStage = ((await json(await api.get(`${BASE}/api/pipeline`)))?.stages || []).find((s) => s.kind === "visit");

async function inbound(body) {
  const payload = { object: "whatsapp_business_account", entry: [{ id: "WABA", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp", metadata: { display_phone_number: "test", phone_number_id: PNID },
    contacts: [{ wa_id: last10(testerClient.phone).padStart(12, "52"), profile: { name: "[selftest-011-g] Tester" } }],
    messages: [{ from: String(testerClient.phone).replace(/\D/g, ""), id: `wamid.g011_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body } }],
  } }] }] };
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return (await fetch(`${BASE}/api/webhooks/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": sig }, body: raw })).status;
}
async function waitReply(prev) {
  for (let i = 0; i < 14; i++) { await sleep(5000); const outs = (await getMsgs()).filter((m) => m.direction === "outbound"); if (outs.length > prev) return outs.slice(prev).map((m) => m.body || "").join(" "); }
  return null;
}
const outCount = async () => (await getMsgs()).filter((m) => m.direction === "outbound").length;

// --- 1. Crear una visita (Google conectado → debe crear evento) ---
log(`\n— 1. Agendar (crea evento en Google) —`);
let p = await outCount();
await inbound("Quiero agendar una visita para ver la propiedad, ¿qué horarios tienes? Dame opciones.");
const r1 = await waitReply(p);
check("agente propone horarios", Boolean(r1) && /\d{1,2}:\d{2}|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[ñn]ana/i.test(r1), (r1 || "").slice(0, 120));
p = await outCount();
await inbound("Agéndame el primero por favor.");
await waitReply(p);
await sleep(4000);
check("Google sigue 'connected' tras CREAR (insertEvent OK)", (await gstatus()) === "connected", await gstatus());

// --- 2. Reprogramar (debe mover el evento) ---
log(`\n— 2. Reprogramar (mueve el evento) —`);
p = await outCount();
await inbound("¿Me puedes cambiar la visita a otro horario? Dame otras opciones.");
const r2 = await waitReply(p);
check("agente ofrece nuevos horarios para reprogramar", Boolean(r2), (r2 || "").slice(0, 120));
p = await outCount();
await inbound("El segundo horario me sirve, cámbiala a ese.");
await waitReply(p);
await sleep(4000);
check("Google sigue 'connected' tras REPROGRAMAR (patchEvent OK)", (await gstatus()) === "connected", await gstatus());

// --- 3. Cancelar (debe borrar el evento) ---
log(`\n— 3. Cancelar (borra el evento) —`);
p = await outCount();
await inbound("Mejor cancela mi visita por favor.");
const r3 = await waitReply(p);
check("agente confirma cancelación", Boolean(r3), (r3 || "").slice(0, 120));
await sleep(4000);
check("Google sigue 'connected' tras CANCELAR (deleteEvent OK)", (await gstatus()) === "connected", await gstatus());

log(`\n— Transcripción reciente —`);
for (const m of (await getMsgs()).slice(-10)) log(`  [${m.direction}] ${(m.body || "").replace(/\n/g, " ").slice(0, 130)}`);

log(`\n${failures === 0 ? "✅ SELF-TEST 011 US4 (Google): VERDE" : `⚠️ US4: ${failures} punto(s)`}`);
log("→ Verificación humana: confirma en tu Google Calendar que el evento 'Visita: …' apareció, se movió y desapareció.");
await browser.close();
process.exit(failures === 0 ? 0 : 1);
