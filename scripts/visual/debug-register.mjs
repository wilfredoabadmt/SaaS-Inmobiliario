// @ts-check
import { chromium } from "@playwright/test";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => console.log("PAGE:", m.type(), m.text()));
page.on("requestfailed", (r) => console.log("REQFAIL:", r.url(), r.failure()?.errorText));

const responses = [];
page.on("response", (res) => {
  const u = res.url();
  if (u.includes("/api/auth")) responses.push(`${res.status()} ${u}`);
});

await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.fill("#email", "demo@inmox.test");
await page.fill("#password", "demo12345");
await page.fill("#agencyName", "Inmobiliaria Demo");
await page.click('form button[type="submit"]');
await page.waitForTimeout(8000);

console.log("URL:", page.url());
const alert = await page.locator('[role="alert"]').allTextContents();
console.log("ALERT:", JSON.stringify(alert));
console.log("AUTH RESPONSES:", JSON.stringify(responses, null, 2));
await page.screenshot({ path: join("scripts", "visual", "out", "debug-register.png") });
await browser.close();
