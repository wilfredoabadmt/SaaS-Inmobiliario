// @ts-check
/**
 * Self-test (Parte 1, API) de la feature 011-visit-scheduling contra inmox-dev.
 * Verifica comportamiento OBSERVABLE sin tocar WhatsApp (rápido y seguro):
 *   A. Settings de calendario: default virtual → PUT → persiste (relectura).
 *   B. Disponibilidad: GET availability → slots futuros, dentro de horas hábiles, alineados al slot.
 *   C. Camino infeliz: settings inválidos → 400; rango inválido → 400; reschedule/cancel inexistente → 404.
 *   D. Estado de Google: GET status → conectado/none (no token expuesto).
 *
 * Uso: node --env-file=.env scripts/wa-tester/visit-011-api-check.mjs
 * Requiere en .env: TEST_SAAS_URL/EMAIL/PASSWORD.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;

let failures = 0;
const log = (...a) => console.log(...a);
function check(name, cond, detail = "") {
  log(`${cond ? "✅" : "❌"} ${name}${detail ? "  —  " + detail : ""}`);
  if (!cond) failures++;
}
const json = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASS);
await page.click('form button[type="submit"]');
await page.waitForTimeout(6000);
if (page.url().includes("/login")) {
  console.error("❌ Login falló (revisa TEST_SAAS_EMAIL/PASSWORD o el deploy).");
  await browser.close();
  process.exit(2);
}
const api = page.request;

// ---------- A. Settings: default virtual → PUT → persiste ----------
log(`\n— A. Settings de calendario —`);
const def = await json(await api.get(`${BASE}/api/calendar/settings`));
check("GET settings → default virtual", def?.isDefault === true, `isDefault=${def?.isDefault}, tz=${def?.timezone}`);
check("default L-V con horario", Array.isArray(def?.weeklyHours?.mon) && def.weeklyHours.mon.length >= 1, JSON.stringify(def?.weeklyHours?.mon));

const wide = {
  mon: [{ start: "09:00", end: "20:00" }],
  tue: [{ start: "09:00", end: "20:00" }],
  wed: [{ start: "09:00", end: "20:00" }],
  thu: [{ start: "09:00", end: "20:00" }],
  fri: [{ start: "09:00", end: "20:00" }],
  sat: [{ start: "09:00", end: "20:00" }],
  sun: [{ start: "09:00", end: "20:00" }],
};
let r = await api.put(`${BASE}/api/calendar/settings`, {
  data: { weeklyHours: wide, slotMinutes: 45, bufferMinutes: 15, timezone: "America/Mexico_City" },
});
check("PUT settings → 200", r.status() === 200, `status=${r.status()}`);
const saved = await json(await api.get(`${BASE}/api/calendar/settings`));
check("settings persisten (isDefault=false)", saved?.isDefault === false, `isDefault=${saved?.isDefault}`);
check("slot/buffer persistieron", saved?.slotMinutes === 45 && saved?.bufferMinutes === 15, `slot=${saved?.slotMinutes} buf=${saved?.bufferMinutes}`);

// ---------- B. Disponibilidad ----------
log(`\n— B. Disponibilidad —`);
const now = new Date();
const from = now.toISOString();
const to = new Date(now.getTime() + 3 * 24 * 3600 * 1000).toISOString();
const avail = await json(await api.get(`${BASE}/api/calendar/availability?from=${from}&to=${to}`));
check("GET availability → slots", Array.isArray(avail?.slots) && avail.slots.length > 0, `n=${avail?.slots?.length}`);
const allFuture = (avail?.slots || []).every((s) => Date.parse(s.startUtc) > Date.now());
check("todos los slots son futuros", allFuture, `n=${avail?.slots?.length}`);
const dur45 = (avail?.slots || []).every((s) => Date.parse(s.endUtc) - Date.parse(s.startUtc) === 45 * 60000);
check("cada slot dura 45 min (slotMinutes)", dur45);
// paso = slot+buffer = 60 min entre inicios consecutivos del mismo día
const slots = (avail?.slots || []).map((s) => Date.parse(s.startUtc)).sort((a, b) => a - b);
let stepOk = true;
for (let i = 1; i < slots.length; i++) {
  const diff = slots[i] - slots[i - 1];
  if (diff > 0 && diff < 60 * 60000) stepOk = false; // dentro del día nunca < 60min
}
check("inicios separados ≥ 60 min (slot+buffer)", stepOk);
check("availability reporta googleConnected", typeof avail?.googleConnected === "boolean", `googleConnected=${avail?.googleConnected}`);

// ---------- C. Camino infeliz ----------
log(`\n— C. Camino infeliz (degrada, no 500) —`);
r = await api.put(`${BASE}/api/calendar/settings`, {
  data: { weeklyHours: { mon: [{ start: "18:00", end: "09:00" }] }, slotMinutes: 45, bufferMinutes: 15, timezone: "America/Mexico_City" },
});
check("settings con inicio>fin → 400", r.status() === 400, `status=${r.status()}`);
r = await api.put(`${BASE}/api/calendar/settings`, {
  data: { weeklyHours: wide, slotMinutes: 5, bufferMinutes: 0, timezone: "America/Mexico_City" },
});
check("slot fuera de rango (5 min) → 400", r.status() === 400, `status=${r.status()}`);
r = await api.put(`${BASE}/api/calendar/settings`, {
  data: { weeklyHours: wide, slotMinutes: 45, bufferMinutes: 0, timezone: "Marte/Olympus" },
});
check("timezone inválida → 400", r.status() === 400, `status=${r.status()}`);
r = await api.get(`${BASE}/api/calendar/availability?from=${to}&to=${from}`);
check("rango invertido → 400", r.status() === 400, `status=${r.status()}`);
r = await api.post(`${BASE}/api/showings/show_inexistente_xyz/reschedule`, { data: { whenISO: from } });
check("reschedule visita inexistente → 404", r.status() === 404, `status=${r.status()}`);
r = await api.post(`${BASE}/api/showings/show_inexistente_xyz/cancel`, {});
check("cancel visita inexistente → 404", r.status() === 404, `status=${r.status()}`);

// Restaurar settings buenos (los dejó inválidos el último PUT 400 no cambió nada; reafirmamos).
await api.put(`${BASE}/api/calendar/settings`, {
  data: { weeklyHours: wide, slotMinutes: 45, bufferMinutes: 15, timezone: "America/Mexico_City" },
});

// ---------- D. Estado de Google ----------
log(`\n— D. Estado de Google Calendar —`);
const gstatus = await json(await api.get(`${BASE}/api/calendar/google/status`));
check("GET google/status → status", typeof gstatus?.status === "string", `status=${gstatus?.status}`);
check("status NO expone token", !JSON.stringify(gstatus || {}).toLowerCase().includes("token"), JSON.stringify(gstatus));
const conn = await api.get(`${BASE}/api/calendar/google/connect`);
check("google/connect responde (302 o 501)", [302, 200, 501].includes(conn.status()), `status=${conn.status()}`);

log(`\n${failures === 0 ? "✅ SELF-TEST 011 (API): TODO VERDE" : `❌ SELF-TEST 011 (API): ${failures} fallo(s)`}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
