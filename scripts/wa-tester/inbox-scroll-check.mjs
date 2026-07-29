// Verifica el fix de scroll del hilo de chat: el composer debe quedar DENTRO del
// viewport (con el bug quedaba empujado abajo, fuera de la vista).
// Uso: node --env-file=.env scripts/wa-tester/inbox-scroll-check.mjs
import { chromium } from "@playwright/test";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const OUT = join("scripts", "visual", "out");
mkdirSync(OUT, { recursive: true });
const VH = 900;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: VH } });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", process.env.TEST_SAAS_EMAIL);
await page.fill("#password", process.env.TEST_SAAS_PASSWORD);
await page.click('form button[type="submit"]');
await page.waitForTimeout(6000);
if (page.url().includes("/login")) {
  console.error("❌ login falló");
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(3000); // que cargue el hilo + auto-scroll

const composer = page.getByPlaceholder("Escribe un mensaje…");
const present = await composer.count();
let fixed = false;
if (present) {
  const box = await composer.boundingBox();
  if (box) {
    const bottom = box.y + box.height;
    fixed = bottom <= VH + 4; // visible dentro del viewport
    console.log(`composer bottom=${Math.round(bottom)}px (viewport=${VH}) → ${fixed ? "VISIBLE ✅" : "FUERA DE VISTA ❌"}`);
  }
} else {
  console.log("composer no presente (¿ventana 24h cerrada?)");
}
await page.screenshot({ path: join(OUT, "inbox-scroll.png") });
await browser.close();
process.exit(fixed ? 0 : 3);
