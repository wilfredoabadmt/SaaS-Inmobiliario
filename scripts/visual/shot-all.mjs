import { chromium } from "@playwright/test";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = join("scripts", "visual", "out");
mkdirSync(OUT, { recursive: true });

const VIEWS = ["inicio", "inbox", "properties", "pipeline", "showings", "clients", "settings"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

for (const v of VIEWS) {
  errs.length = 0;
  const resp = await page.goto(`${BASE}/dev-preview/${v}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  console.log(`${v}: status ${resp?.status()}${errs.length ? " ERRORS: " + errs.join(" | ") : ""}`);
  await page.screenshot({ path: join(OUT, `view-${v}.png`) });
}

await browser.close();
console.log("done");
