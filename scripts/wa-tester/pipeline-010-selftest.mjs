// @ts-check
/**
 * Self-test E2E de la US1 de la feature 010 (pipeline de ventas) contra inmox-dev.
 * Verifica comportamiento OBSERVABLE (Definición de Hecho reforzada):
 *   A. Tablero real: GET /api/pipeline → 8 etapas sembradas (Nuevo…Perdido).
 *   B. Crear trato (alta manual) sin propiedad → aparece en la etapa inicial ("Nuevo").
 *   C. Mover trato (PATCH) a "Contactado" → persiste (relectura del tablero del servidor).
 *   D. Camino infeliz: stage inexistente → 400 invalid_stage; deal inexistente → 404 (sin fuga).
 *   E. Auto-alta por inbound: webhook FIRMADO (número ficticio) → candidacy sin-propiedad en
 *      "Nuevo"; reenviar NO duplica (idempotente). Limpieza: archiva los contactos de prueba.
 *
 * Uso: PHONE_NUMBER_ID=<id> node --env-file=.env scripts/wa-tester/pipeline-010-selftest.mjs
 * Requiere en .env: TEST_SAAS_URL/EMAIL/PASSWORD + META_APP_SECRET (firma del webhook).
 */
import { createHmac } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const SECRET = process.env.META_APP_SECRET;
const PNID = process.env.PHONE_NUMBER_ID;

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

// ---------- Login (Playwright) → sesión compartida con page.request ----------
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

const getBoard = async () => (await json(await api.get(`${BASE}/api/pipeline`))) || { stages: [], deals: [] };
const listAllClients = async () =>
  (await json(await api.get(`${BASE}/api/clients?archived=all`)))?.clients || [];

// ---------- A. Tablero real con etapas sembradas ----------
log(`\n— A. Tablero real (etapas sembradas) —`);
const board0 = await getBoard();
const stageLabels = board0.stages.map((s) => s.label);
check("GET /api/pipeline → 8 etapas", board0.stages.length === 8, `n=${board0.stages.length} [${stageLabels.join(", ")}]`);
const nuevo = board0.stages.find((s) => s.label === "Nuevo");
const contactado = board0.stages.find((s) => s.label === "Contactado");
const ganado = board0.stages.find((s) => s.kind === "won");
check("etapa inicial 'Nuevo' (sortOrder 0)", Boolean(nuevo) && nuevo.sortOrder === 0, `sortOrder=${nuevo?.sortOrder}`);
check("ancla won = 'Ganado'", ganado?.label === "Ganado", `kind/label=${ganado?.kind}/${ganado?.label}`);

// ---------- B. Crear trato (alta manual) sin propiedad ----------
log(`\n— B. Crear trato (sin propiedad) → "Nuevo" —`);
const phoneB = "529991" + Date.now().toString().slice(-7);
const clientB = (await json(await api.post(`${BASE}/api/clients`, {
  data: { name: "[selftest-010] Cliente B", phone: phoneB },
})))?.id;
check("cliente de prueba creado", Boolean(clientB), clientB || "");
let r = await api.post(`${BASE}/api/pipeline/deals`, { data: { clientId: clientB, propertyId: null } });
check("POST /api/pipeline/deals → 201", r.status() === 201, `status=${r.status()}`);
const dealB = await json(r);
check("trato creado en la etapa inicial", dealB?.stageId === nuevo?.id, `stageId=${dealB?.stageId}`);
let board = await getBoard();
let cardB = board.deals.find((d) => d.id === dealB?.id);
check("la tarjeta aparece en el tablero", Boolean(cardB), cardB ? `stage=${cardB.stageId}` : "no está");
check("tarjeta sin propiedad", cardB != null && cardB.property === null, `property=${JSON.stringify(cardB?.property)}`);

// ---------- C. Mover trato → persiste ----------
log(`\n— C. Mover a "Contactado" → persiste —`);
r = await api.patch(`${BASE}/api/pipeline/deals/${dealB?.id}`, { data: { stageId: contactado?.id } });
check("PATCH mover → 200", r.status() === 200, `status=${r.status()}`);
board = await getBoard(); // relectura del servidor = prueba de persistencia
cardB = board.deals.find((d) => d.id === dealB?.id);
check("el trato quedó en 'Contactado' (persistió)", cardB?.stageId === contactado?.id, `stageId=${cardB?.stageId}`);

// ---------- D. Camino infeliz ----------
log(`\n— D. Camino infeliz (degrada, no 500) —`);
r = await api.patch(`${BASE}/api/pipeline/deals/${dealB?.id}`, { data: { stageId: "pst_inexistente_xyz" } });
check("mover a etapa inexistente → 400 invalid_stage", r.status() === 400, `status=${r.status()}`);
r = await api.patch(`${BASE}/api/pipeline/deals/cand_inexistente_xyz`, { data: { stageId: nuevo?.id } });
check("PATCH deal inexistente/otra org → 404 (sin fuga)", r.status() === 404, `status=${r.status()}`);

// ---------- E. Auto-alta por inbound (webhook firmado) + idempotencia ----------
log(`\n— E. Auto-alta de trato por inbound (webhook firmado) —`);
const simPhone = "529992" + Date.now().toString().slice(-7);
let simClientId = null;
if (!SECRET || !PNID) {
  log("  ⏭️  E OMITIDO (falta PHONE_NUMBER_ID en env) — pendiente: correr con PHONE_NUMBER_ID=<id>.");
} else {
  const postInbound = async (body) => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "WABA_TEST",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "test", phone_number_id: PNID },
            contacts: [{ wa_id: simPhone, profile: { name: "[selftest-010] Prospecto Pipeline" } }],
            messages: [{
              from: simPhone,
              id: `wamid.sim010_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: "text",
              text: { body },
            }],
          },
        }],
      }],
    };
    const raw = JSON.stringify(payload);
    const sig = "sha256=" + createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
    return fetch(`${BASE}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-signature-256": sig },
      body: raw,
    });
  };

  const res1 = await postInbound("Hola, busco depto (sim pipeline 1)");
  check("POST webhook firmado → 200", res1.status === 200, `status=${res1.status}`);
  if (res1.status === 401) log("  ⚠️ 401 = META_APP_SECRET local ≠ Coolify (firma); sería el motivo de webhooks reales fallando.");

  // Resolver el clientId del número ficticio y esperar a que el auto-alta cree el trato (after()).
  log("  esperando el auto-alta del trato (poll hasta ~30s)…");
  let simDeals = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(3000);
    const cli = (await listAllClients()).find((c) => (c.phone || "").replace(/\D/g, "").endsWith(simPhone.slice(-10)));
    simClientId = cli?.id ?? null;
    if (simClientId) {
      const b = await getBoard();
      simDeals = b.deals.filter((d) => d.client.id === simClientId);
      if (simDeals.length >= 1) break;
    }
    process.stdout.write(`  …${(i + 1) * 3}s (client=${Boolean(simClientId)}, deals=${simDeals.length})\n`);
  }
  check("contacto auto-creado por el webhook", Boolean(simClientId), simClientId || "no");
  check("trato auto-creado para el contacto", simDeals.length >= 1, `deals=${simDeals.length}`);
  check("trato en etapa inicial 'Nuevo'", simDeals[0]?.stageId === nuevo?.id, `stage=${simDeals[0]?.stageId}`);
  check("trato sin propiedad", simDeals[0] != null && simDeals[0].property === null, `property=${JSON.stringify(simDeals[0]?.property)}`);

  // Idempotencia: segundo inbound del mismo número → NO crea un segundo trato sin-propiedad.
  const res2 = await postInbound("Sigo interesado (sim pipeline 2)");
  check("2º POST webhook firmado → 200", res2.status === 200, `status=${res2.status}`);
  await page.waitForTimeout(4000);
  const b2 = await getBoard();
  const noProp = b2.deals.filter((d) => d.client.id === simClientId && d.property === null);
  check("idempotente: sigue habiendo 1 trato sin-propiedad", noProp.length === 1, `count=${noProp.length}`);
}

// ---------- F. US2: etapas configurables (owner) ----------
log(`\n— F. Etapas configurables (US2, owner) —`);
const stagesList = (await json(await api.get(`${BASE}/api/pipeline/stages`)))?.stages || [];
check("GET /api/pipeline/stages (owner) → lista", stagesList.length === 8, `n=${stagesList.length}`);
check("anclas marcadas no eliminables", stagesList.filter((s) => !s.deletable).length === 3, `anclas=${stagesList.filter((s) => !s.deletable).length}`);

r = await api.post(`${BASE}/api/pipeline/stages`, { data: { label: "[selftest] Etapa" } });
check("POST crear etapa → 201", r.status() === 201, `status=${r.status()}`);
const newStageId = (await json(r))?.id;
r = await api.patch(`${BASE}/api/pipeline/stages/${newStageId}`, { data: { label: "[selftest] Renombrada" } });
check("PATCH renombrar etapa → 200", r.status() === 200, `status=${r.status()}`);
const renamed = ((await json(await api.get(`${BASE}/api/pipeline/stages`)))?.stages || []).find((s) => s.id === newStageId);
check("etiqueta renombrada persiste", renamed?.label === "[selftest] Renombrada", renamed?.label || "");

// reorder válido (conjunto exacto) + inválido (falta una)
const allIds = ((await json(await api.get(`${BASE}/api/pipeline/stages`)))?.stages || []).map((s) => s.id);
r = await api.put(`${BASE}/api/pipeline/stages/order`, { data: { orderedIds: allIds } });
check("PUT reordenar (conjunto exacto) → 200", r.status() === 200, `status=${r.status()}`);
r = await api.put(`${BASE}/api/pipeline/stages/order`, { data: { orderedIds: allIds.slice(1) } });
check("PUT reordenar (incompleto) → 400 invalid_order", r.status() === 400, `status=${r.status()}`);

// borrar ancla → 400
const anchorId = stagesList.find((s) => s.kind === "won")?.id;
r = await api.delete(`${BASE}/api/pipeline/stages/${anchorId}`);
check("DELETE ancla (Ganado) → 400 anchor_stage", r.status() === 400, `status=${r.status()}`);

// borrar etapa con tratos → 409 → con reasignación → 200
const clientF = (await json(await api.post(`${BASE}/api/clients`, { data: { name: "[selftest-010] Cliente F", phone: "529993" + Date.now().toString().slice(-7) } })))?.id;
const dealF = (await json(await api.post(`${BASE}/api/pipeline/deals`, { data: { clientId: clientF, stageId: newStageId } })))?.id;
r = await api.delete(`${BASE}/api/pipeline/stages/${newStageId}`);
check("DELETE etapa con tratos sin reasignar → 409", r.status() === 409, `status=${r.status()}`);
r = await api.delete(`${BASE}/api/pipeline/stages/${newStageId}?reassignToStageId=${nuevo?.id}`);
check("DELETE etapa con tratos + reasignación → 200", r.status() === 200, `status=${r.status()}`);
const boardF = await getBoard();
check("el trato se reubicó en 'Nuevo' al borrar su etapa", boardF.deals.find((d) => d.id === dealF)?.stageId === nuevo?.id, `stage=${boardF.deals.find((d) => d.id === dealF)?.stageId}`);

// ---------- G. US4: panel de detalle ----------
log(`\n— G. Panel de detalle (US4) —`);
const detail = await json(await api.get(`${BASE}/api/pipeline/deals/${dealB?.id}`));
check("GET detalle del trato → cliente correcto", detail?.client?.id === clientB, `client=${detail?.client?.id}`);
check("detalle trae conversationId (deep-link a bandeja)", Boolean(detail?.conversationId), detail?.conversationId || "");

// ---------- H. US5: asignación real ----------
log(`\n— H. Asignación de agente (US5) —`);
const membersList = (await json(await api.get(`${BASE}/api/pipeline/members`)))?.members || [];
check("GET /api/pipeline/members → ≥1 miembro", membersList.length >= 1, `n=${membersList.length}`);
const agentId = membersList[0]?.id;
r = await api.patch(`${BASE}/api/pipeline/deals/${dealB?.id}`, { data: { assignedAgentId: agentId } });
check("PATCH asignar agente → 200", r.status() === 200, `status=${r.status()}`);
let bAssign = await getBoard();
check("la tarjeta muestra el agente asignado", bAssign.deals.find((d) => d.id === dealB?.id)?.assignedAgent?.id === agentId, `agent=${bAssign.deals.find((d) => d.id === dealB?.id)?.assignedAgent?.id}`);
r = await api.patch(`${BASE}/api/pipeline/deals/${dealB?.id}`, { data: { assignedAgentId: "usr_no_member_xyz" } });
check("asignar a no-miembro → 400 not_a_member", r.status() === 400, `status=${r.status()}`);
r = await api.patch(`${BASE}/api/pipeline/deals/${dealB?.id}`, { data: { assignedAgentId: null } });
check("desasignar (Sin asignar) → 200", r.status() === 200, `status=${r.status()}`);

// ---------- Limpieza: archivar los contactos de prueba (sus tratos salen del tablero) ----------
log(`\n— Limpieza —`);
for (const cid of [clientB, clientF, simClientId].filter(Boolean)) {
  await api.post(`${BASE}/api/clients/${cid}/archive`, { data: { archived: true } });
}
const after = await getBoard();
const leftovers = after.deals.filter((d) => [clientB, clientF, simClientId].includes(d.client.id));
check("tratos de prueba removidos del tablero (cliente archivado)", leftovers.length === 0, `quedan=${leftovers.length}`);

log(`\n${failures === 0 ? "✅ SELF-TEST 010 US1: TODO VERDE" : `❌ SELF-TEST 010 US1: ${failures} fallo(s)`}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
