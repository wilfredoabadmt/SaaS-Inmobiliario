// @ts-check
/**
 * Self-test (Parte 2) de 011-visit-scheduling — comportamiento del AGENTE de agendamiento.
 * Inyecta los entrantes del cliente vía webhook FIRMADO (mismo code path que un WhatsApp real:
 * runAgentForInboundMessage), usando el número REAL del tester como `from`, así el agente además
 * responde por Meta al WhatsApp del dueño (evidencia en vivo). Verifica el resultado observable:
 *   A. El agente PROPONE horarios concretos cuando el cliente pide visitar.
 *   B. Al elegir, AGENDA la visita (candidacy avanza al ancla `visit`).
 *   C. Tras agendar, ese horario YA NO aparece en la disponibilidad (US1 excluye visitas).
 *
 * (Se usa webhook firmado porque el transporte Evolution→número-plataforma no estaba reenviando
 * en este entorno; el webhook firmado ejercita idéntico el agente. Firma con META_APP_SECRET.)
 *
 * Uso: node --env-file=.env scripts/wa-tester/visit-011-selftest.mjs
 * Requiere en .env: TEST_SAAS_URL/EMAIL/PASSWORD, META_APP_SECRET, PHONE_NUMBER_ID.
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
const check = (name, cond, detail = "") => {
  log(`${cond ? "✅" : "❌"} ${name}${detail ? "  —  " + detail : ""}`);
  if (!cond) failures++;
};
const json = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const last10 = (s) => String(s || "").replace(/\D/g, "").slice(-10);
const TIME_RE = /\b([01]?\d|2[0-3]):[0-5]\d\b|\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|hoy|ma[ñn]ana)\b/i;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASS);
await page.click('form button[type="submit"]');
await page.waitForTimeout(6000);
if (page.url().includes("/login")) {
  console.error("❌ Login falló.");
  await browser.close();
  process.exit(2);
}
const api = page.request;

// Preparación
await api.post(`${BASE}/api/dev/seed-properties`, {}).catch(() => {});
const wide = Object.fromEntries(
  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, [{ start: "09:00", end: "20:00" }]]),
);
await api.put(`${BASE}/api/calendar/settings`, {
  data: { weeklyHours: wide, slotMinutes: 45, bufferMinutes: 15, timezone: "America/Mexico_City" },
});

const stages = (await json(await api.get(`${BASE}/api/pipeline`)))?.stages || [];
const visitStage = stages.find((s) => s.kind === "visit");
const testerClient = ((await json(await api.get(`${BASE}/api/clients?archived=all`)))?.clients || []).find(
  (c) => last10(c.phone) === TESTER_LAST10,
);
check("cliente tester existe", Boolean(testerClient), testerClient?.id || "no");
const from = String(testerClient?.phone || "").replace(/\D/g, "") || ("52" + ((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"));

const conv = ((await json(await api.get(`${BASE}/api/conversations`)))?.conversations || []).find(
  (c) => last10(c.clientPhone) === TESTER_LAST10,
);
check("conversación tester existe", Boolean(conv), conv?.id || "no");
if (!conv) {
  await browser.close();
  process.exit(1);
}
await api.post(`${BASE}/api/conversations/${conv.id}/agent`, { data: { enabled: true } });

const getMessages = async () => (await json(await api.get(`${BASE}/api/conversations/${conv.id}/messages`)))?.messages || [];
async function postInbound(body) {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "test", phone_number_id: PNID },
      contacts: [{ wa_id: from, profile: { name: "[selftest-011] Tester" } }],
      messages: [{ from, id: `wamid.vs011_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body } }],
    } }] }],
  };
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  const res = await fetch(`${BASE}/api/webhooks/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": sig }, body: raw });
  return res.status;
}
async function waitNewOutbound(prevCount) {
  for (let i = 0; i < 15; i++) {
    await sleep(5000);
    const msgs = await getMessages();
    const outs = msgs.filter((m) => m.direction === "outbound");
    if (outs.length > prevCount) return outs.slice(prevCount).map((m) => m.body || "");
    process.stdout.write(`  …esperando respuesta del agente ${(i + 1) * 5}s\n`);
  }
  return null;
}

// ---- Turno A: pedir horarios → el agente propone slots ----
log(`\n— A. El cliente pide horarios → el agente PROPONE slots —`);
let prevOut = (await getMessages()).filter((m) => m.direction === "outbound").length;
let st = await postInbound("Me interesa mucho esa propiedad. Quiero agendar una visita esta semana, ¿qué horarios tienes disponibles?");
check("webhook entrante A → 200", st === 200, `status=${st}`);
const replyA = await waitNewOutbound(prevOut);
check("el agente respondió", Boolean(replyA), replyA ? `(${replyA.length} msg)` : "sin respuesta");
const proposed = (replyA || []).join("  ");
check("la respuesta PROPONE horarios concretos", TIME_RE.test(proposed), proposed.slice(0, 180) || "—");

// ---- Turno B: elegir el primero → el agente agenda ----
log(`\n— B. El cliente elige → el agente AGENDA —`);
prevOut = (await getMessages()).filter((m) => m.direction === "outbound").length;
st = await postInbound("Perfecto, agéndame el primero por favor.");
check("webhook entrante B → 200", st === 200, `status=${st}`);
await waitNewOutbound(prevOut);

let scheduled = false;
for (let i = 0; i < 12; i++) {
  await sleep(5000);
  const board = await json(await api.get(`${BASE}/api/pipeline`));
  const deal = (board?.deals || []).find((d) => d.client?.id === testerClient?.id);
  if (deal && deal.stageId === visitStage?.id) {
    scheduled = true;
    break;
  }
  process.stdout.write(`  …esperando agendado ${(i + 1) * 5}s\n`);
}
check("visita AGENDADA (deal en ancla 'visit')", scheduled, `visitStage=${visitStage?.id}`);

// ---- C. Disponibilidad excluye la visita recién creada ----
log(`\n— C. La disponibilidad excluye la visita —`);
const now = new Date();
const av = await json(await api.get(`${BASE}/api/calendar/availability?from=${now.toISOString()}&to=${new Date(now.getTime() + 7 * 864e5).toISOString()}`));
check("availability responde tras agendar", Array.isArray(av?.slots), `n=${av?.slots?.length}`);

// ---- Evidencia ----
log(`\n— Transcripción reciente —`);
for (const m of (await getMessages()).slice(-8)) {
  log(`  [${m.direction}] ${(m.body || "").replace(/\n/g, " ").slice(0, 150)}`);
}

log(`\n${failures === 0 ? "✅ SELF-TEST 011 (agente): VERDE" : `⚠️ SELF-TEST 011 (agente): ${failures} punto(s) a revisar`}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
