// @ts-check
/**
 * Self-test E2E de la feature 009 (gestión de contactos) contra inmox-dev.
 * Verifica comportamiento OBSERVABLE (Definición de Hecho reforzada):
 *   A. CRUD manual + 409 (teléfono duplicado) + 404 (id inexistente / no fuga).
 *   C. Deep-link "Enviar mensaje": get-or-create conversación → shell sin mensajes.
 *   D. Archivar / restaurar (soft-delete reversible): excluido de activos, visible en archivados.
 *   B. Auto-alta + canal + REACTIVACIÓN desde un INBOUND REAL (línea personal → plataforma):
 *      archivamos la línea personal, el inbound la reactiva (archivedAt→null), channel='whatsapp',
 *      sin duplicar, sin pisar el nombre. Red de seguridad: deja la línea personal ACTIVA.
 *
 * Uso: node --env-file=.env scripts/wa-tester/clients-009-selftest.mjs
 */
import { chromium } from "@playwright/test";
import { sendText, PLATFORM_NUMBER } from "./evolution-client.mjs";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const TESTER_LAST10 = ((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"); // línea personal del dueño = "cliente" que escribe

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
const listClients = async (api, qs = "") =>
  (await json(await api.get(`${BASE}/api/clients${qs}`)))?.clients || [];
const byTester = (arr) => arr.filter((c) => (c.phone || "").replace(/\D/g, "").endsWith(TESTER_LAST10));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASS);
await page.click('form button[type="submit"]');
await page.waitForTimeout(6000);
if (page.url().includes("/login")) {
  console.error("❌ Login falló (revisa TEST_SAAS_EMAIL/PASSWORD o que el deploy esté vivo).");
  await browser.close();
  process.exit(2);
}
const api = page.request;

// ---------- A. CRUD manual + 409 + 404 ----------
const phoneA = "5299" + Date.now().toString().slice(-9);
log(`\n— A. CRUD manual + 409 + 404 —  (phone ${phoneA})`);

let r = await api.post(`${BASE}/api/clients`, {
  data: { name: "[selftest] Contacto A", phone: phoneA, email: "selftest@example.com" },
});
check("POST crear → 201", r.status() === 201, `status=${r.status()}`);
const id = (await json(r))?.id;
check("crear devuelve id", Boolean(id), id || "");

const detail = await json(await api.get(`${BASE}/api/clients/${id}`));
check("GET detalle → channel='manual'", detail?.channel === "manual", `channel=${detail?.channel}`);

r = await api.patch(`${BASE}/api/clients/${id}`, { data: { name: "[selftest] Contacto A (editado)" } });
check("PATCH editar nombre → 200", r.status() === 200, `status=${r.status()}`);
const d2 = await json(await api.get(`${BASE}/api/clients/${id}`));
check("nombre persiste tras editar", d2?.name === "[selftest] Contacto A (editado)", d2?.name || "");

r = await api.post(`${BASE}/api/clients`, { data: { name: "[selftest] dup", phone: phoneA } });
check("POST teléfono duplicado → 409", r.status() === 409, `status=${r.status()}`);

const phoneB = "5298" + Date.now().toString().slice(-9);
const idB = (await json(await api.post(`${BASE}/api/clients`, {
  data: { name: "[selftest] Contacto B", phone: phoneB },
})))?.id;
r = await api.patch(`${BASE}/api/clients/${idB}`, { data: { phone: phoneA } });
check("PATCH teléfono a uno existente → 409", r.status() === 409, `status=${r.status()}`);

r = await api.get(`${BASE}/api/clients/cli_inexistente_xyz_009`);
check("GET id inexistente → 404 (sin fuga)", r.status() === 404, `status=${r.status()}`);

// ---------- C. Deep-link "Enviar mensaje" ----------
log(`\n— C. Deep-link a la bandeja (US4) —`);
r = await api.post(`${BASE}/api/clients/${id}/conversation`, {});
const convId = (await json(r))?.conversationId;
check("POST .../conversation → 200 + conversationId", r.status() === 200 && Boolean(convId), convId || "");
if (convId) {
  const msgs = await json(await api.get(`${BASE}/api/conversations/${convId}/messages`));
  check("conversación shell con 0 mensajes (→ bandeja exige plantilla)", (msgs?.messages?.length ?? -1) === 0, `msgs=${msgs?.messages?.length}`);
}

// ---------- D. Archivar / restaurar (soft-delete) ----------
log(`\n— D. Archivar / restaurar (soft-delete reversible) —`);
r = await api.post(`${BASE}/api/clients/${id}/archive`, { data: { archived: true } });
check("POST archive {archived:true} → 200", r.status() === 200, `status=${r.status()}`);
check("archivado NO aparece en la lista activa", !(await listClients(api)).some((c) => c.id === id));
const archRow = (await listClients(api, "?archived=archived")).find((c) => c.id === id);
check("aparece en archivados con archivedAt", Boolean(archRow?.archivedAt), archRow?.archivedAt || "");
r = await api.post(`${BASE}/api/clients/${id}/archive`, { data: { archived: false } });
check("POST archive {archived:false} → 200", r.status() === 200, `status=${r.status()}`);
const restored = (await listClients(api)).find((c) => c.id === id);
check("restaurado vuelve a activos (archivedAt null)", Boolean(restored) && !restored?.archivedAt);

// ---------- B. Auto-alta + canal + REACTIVACIÓN desde inbound real ----------
log(`\n— B. Auto-alta + reactivación desde inbound real (línea personal → plataforma) —`);
let personal = null;
try {
  personal = byTester(await listClients(api, "?archived=all"))[0] ?? null;
  log(`  contacto línea personal ANTES: ${personal ? `channel=${personal.channel}, name=${JSON.stringify(personal.name)}, archived=${Boolean(personal.archivedAt)}` : "no existe (se creará)"}`);

  // Archivar la línea personal para probar que el inbound la REACTIVA.
  if (personal) {
    await api.post(`${BASE}/api/clients/${personal.id}/archive`, { data: { archived: true } });
    log("  línea personal archivada; el inbound debería reactivarla.");
  }

  await sendText(PLATFORM_NUMBER, `Hola, prospecto de prueba 009 (#${Date.now().toString().slice(-5)}). ¿Tienen deptos en renta?`);
  log("  inbound enviado; esperando reactivación (poll hasta ~72s, la entrega del webhook tarda)…");
  let after = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(6000);
    after = byTester(await listClients(api)); // lista ACTIVA (excluye archivados)
    if (after.length === 1 && !after[0]?.archivedAt) break;
    process.stdout.write(`  …${(i + 1) * 6}s (activos=${after.length})\n`);
  }
  check("auto-alta: contacto ACTIVO tras inbound (reactivado)", after.length === 1, `count=${after.length}`);
  check("sin duplicados para ese teléfono", after.length === 1, `count=${after.length}`);
  check("canal de origen = whatsapp", after[0]?.channel === "whatsapp", `channel=${after[0]?.channel}`);
  check("reactivado: archivedAt = null", Boolean(after[0]) && !after[0]?.archivedAt);
  if (personal?.name) check("nombre previo NO se sobrescribió", after[0]?.name === personal.name, `${personal.name} → ${after[0]?.name}`);
} catch (e) {
  check("envío del inbound (Evolution)", false, e instanceof Error ? e.message : String(e));
} finally {
  // Red de seguridad: nunca dejar la línea personal del dueño archivada.
  if (personal) {
    const stillArchived = (await listClients(api, "?archived=archived")).find((c) => c.id === personal.id);
    if (stillArchived) {
      await api.post(`${BASE}/api/clients/${personal.id}/archive`, { data: { archived: false } });
      log("  ⚠️ red de seguridad: restauré la línea personal (el inbound no la reactivó).");
    }
  }
}

log(`\n${failures === 0 ? "✅ SELF-TEST 009: TODO VERDE" : `❌ SELF-TEST 009: ${failures} fallo(s)`}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
