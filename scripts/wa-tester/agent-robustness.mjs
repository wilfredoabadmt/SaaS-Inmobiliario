// Self-test de robustez del agente (feature 005). Activa el agente en la conversación
// de prueba y ejerce los casos límite. Reusa el guardrail/allowlist + anti-ráfaga.
// Uso: node --env-file=.env scripts/wa-tester/agent-robustness.mjs
//
// IMPORTANTE — honestidad de cobertura (Principio V):
//   Solo el CASO B (no-texto) es reproducible de forma segura por este tester en vivo.
//   Los demás chocan con condiciones que el tester guardado no puede crear:
//     · CASO A (fuera de ventana 24 h): un entrante nuevo REABRE la ventana, así que el
//       agente nunca corre fuera de ventana por el flujo reactivo. Es un guard defensivo;
//       se verifica envejeciendo el último entrante en la BD e invocando el agente
//       directamente (no por un mensaje nuevo). Ver instrucciones impresas abajo.
//     · CASO C (ráfaga): el guardrail anti-ráfaga fuerza ≥15 s entre envíos para no
//       bloquear la línea personal; no se puede mandar una ráfaga < AGENT_COALESCE_MS
//       (~6 s) desde el tester. Verificar la coalescencia con un test unitario del
//       módulo src/server/ai/coalesce.ts o relajando el gap en un entorno aislado.
//     · CASO D (fallo de IA): requiere inyectar un fallo en el servidor (clave/ modelo
//       inválidos por env); no es accionable desde el tester. Verificar en el deploy.
import { chromium } from "@playwright/test";
import { sendLocation, confirmAccess } from "./evolution-client.mjs";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const PLATFORM = (process.env.PLATFORM_TEST_NUMBER || "0000000000"); // número de prueba de la plataforma (+1 555-176-8947)

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

// Reanudar (activa agente + limpia needs_human y motivo).
const ag = await api.post(`${BASE}/api/conversations/${conv.id}/agent`, { data: { resume: true } });
console.log("agente (resume):", ag.status(), JSON.stringify(await ag.json().catch(() => ({}))));

const before = (await (await api.get(`${BASE}/api/conversations/${conv.id}/messages`)).json()).messages || [];

// ---------- CASO B: mensaje NO textual (ubicación) ----------
console.log("\n=== CASO B · no-texto (ubicación) ===");
console.log("evolution:", JSON.stringify(await confirmAccess()));
console.log("→ (cliente) envío una UBICACIÓN…");
await sendLocation(PLATFORM);

let ok = false;
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(6000);
  const msgs = (await (await api.get(`${BASE}/api/conversations/${conv.id}/messages`)).json()).messages || [];
  const recent = msgs.slice(before.length);
  const inboundNonText = recent.find((m) => m.direction === "inbound" && m.waType && m.waType !== "text");
  const askedForText = recent.find(
    (m) => m.direction === "outbound" && m.aiGenerated && (m.body || "").toLowerCase().includes("texto"),
  );
  if (inboundNonText && askedForText) {
    console.log("✅ no-texto persistido:", inboundNonText.waType, "| el agente pidió texto:");
    console.log("   🤖", askedForText.body);
    ok = true;
    break;
  }
  process.stdout.write(`  …${(i + 1) * 6}s\n`);
}
if (!ok) console.log("⚠️ No se detectó el manejo de no-texto en ~72 s (revisar deploy/migración/logs).");

// Estado final.
const after = (await (await api.get(`${BASE}/api/conversations`)).json()).conversations || [];
const c2 = after.find((c) => c.id === conv.id);
console.log(`\nestado → aiEnabled=${c2?.aiEnabled} needsHuman=${c2?.needsHuman} reason=${c2?.needsHumanReason ?? "—"}`);

console.log(`
--- Casos que requieren condiciones especiales (no por el tester guardado) ---
A (fuera de 24 h): en la BD, UPDATE message SET wa_timestamp = now() - interval '25 hours'
   para el último entrante de la conversación; invoca el agente directamente (no por un
   mensaje nuevo) y verifica 0 salientes + needs_human_reason='out_of_window'.
C (ráfaga): test unitario de src/server/ai/coalesce.ts (3 scheduleAgentRun seguidos →
   una sola corrida) o relaja el gap del tester SOLO en un entorno aislado.
D (fallo IA): en el deploy, pon OPENROUTER_AGENT_MODEL a un modelo inexistente (o la
   clave inválida), envía un texto y verifica needs_human_reason='ai_error' + 0 salientes
   + la bandeja del resto operativa + sin clave en logs. Restaura la env al terminar.
`);

await browser.close();
