// @ts-check
/**
 * Pipeline de captura visual con Playwright para iterar el diseño.
 * Inicia sesión (o registra) un TENANT DEMO AISLADO (demo@inmox.test) — nunca
 * la cuenta real del dueño — y toma capturas de las rutas indicadas.
 *
 * Uso:
 *   node scripts/visual/capture.mjs inbox
 *   node scripts/visual/capture.mjs /inbox /properties
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const DEMO = { email: "demo@inmox.test", password: "demo12345", agency: "Inmobiliaria Demo" };
const OUT = join("scripts", "visual", "out");

const routes = (process.argv.slice(2).length ? process.argv.slice(2) : ["/inbox"]).map((r) =>
  r.startsWith("/") ? r : `/${r}`,
);

async function onInbox(page) {
  return /\/inbox/.test(page.url());
}

async function ensureLoggedIn(page) {
  // 1) Intentar iniciar sesión.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", DEMO.email);
  await page.fill("#password", DEMO.password);
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(3500);
  if (await onInbox(page)) return "login";

  // 2) Si no entró, registrar el tenant demo.
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.fill("#email", DEMO.email);
  await page.fill("#password", DEMO.password);
  await page.fill("#agencyName", DEMO.agency);
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(5000);
  if (await onInbox(page)) return "register";

  throw new Error(`No se pudo iniciar sesión ni registrar (url=${page.url()}).`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);

  try {
    const how = await ensureLoggedIn(page);
    console.log(`Sesión demo OK (${how}).`);

    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const file = join(OUT, `${route.replace(/\W+/g, "_").replace(/^_|_$/g, "") || "root"}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`📸 ${route} → ${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
