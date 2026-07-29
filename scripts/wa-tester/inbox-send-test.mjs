// Test E2E del envío desde la bandeja, con Playwright. Login owner (de .env) →
// /inbox → escribe → envía → reporta si salió o si Meta lo rechazó (con código).
// Uso: node --env-file=.env scripts/wa-tester/inbox-send-test.mjs
import { chromium } from "@playwright/test";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const EMAIL = process.env.TEST_SAAS_EMAIL;
const PASS = process.env.TEST_SAAS_PASSWORD;
const OUT = join("scripts", "visual", "out");
mkdirSync(OUT, { recursive: true });

if (!EMAIL || !PASS) {
  console.error("Faltan TEST_SAAS_EMAIL / TEST_SAAS_PASSWORD en .env");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const log = (...a) => console.log(...a);

// 1) Login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", PASS);
await page.click('form button[type="submit"]');
await page.waitForTimeout(6000);

// Señal fiable de éxito = llegamos a /inbox; si seguimos en /login, falló.
if (page.url().includes("/login")) {
  const alertTxt = (await page.locator('[role="alert"]').allTextContents())
    .map((t) => t.trim())
    .filter(Boolean)
    .join(" | ");
  log("❌ LOGIN FALLÓ (sigue en /login). alert:", JSON.stringify(alertTxt || "(vacío)"));
  await page.screenshot({ path: join(OUT, "inbox-test-login.png") });
  await browser.close();
  process.exit(2);
}
if (!page.url().includes("/inbox")) {
  await page.goto(`${BASE}/inbox`, { waitUntil: "networkidle" });
}
log("✅ Login OK, en", page.url());
await page.waitForTimeout(2500);

// 2) Composer: ventana abierta (textarea) o cerrada (plantilla)
const textarea = page.getByPlaceholder("Escribe un mensaje…");
const hasTextarea = await textarea.count();
if (!hasTextarea) {
  log("⚠️ No hay textarea: la ventana de 24h podría estar cerrada o no hay conversación.");
  await page.screenshot({ path: join(OUT, "inbox-test-state.png") });
  // intentar plantilla
  const tplSelect = page.locator("select").first();
  if (await tplSelect.count()) {
    const opts = await tplSelect.locator("option").allTextContents();
    log("Plantillas disponibles:", JSON.stringify(opts));
  }
  await browser.close();
  process.exit(3);
}

// 3) Enviar texto único
const stamp = new Date().toISOString().slice(11, 19);
const msg = `Prueba automática de Inmox ${stamp}`;
await textarea.fill(msg);
await page.getByLabel("Enviar").click();
log("→ enviado:", msg);
await page.waitForTimeout(7000); // > intervalo de polling (4s)

// 4) Resultado
const errorBanner = page.getByText(/WhatsApp rechazó/i);
const errCount = await errorBanner.count();
if (errCount) {
  const txt = (await errorBanner.allTextContents()).join(" | ");
  log("❌ ENVÍO RECHAZADO:", txt);
} else {
  const bubble = page.getByText(msg, { exact: false });
  const appeared = await bubble.count();
  log(appeared ? "✅ ENVÍO OK: el mensaje aparece en el hilo." : "⚠️ Sin error, pero no se ubicó la burbuja (revisar captura).");
}

await page.screenshot({ path: join(OUT, "inbox-test-result.png"), fullPage: false });
log("captura: scripts/visual/out/inbox-test-result.png");
await browser.close();
