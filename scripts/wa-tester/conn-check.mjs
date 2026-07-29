// @ts-check
/** Diagnóstico: ¿la org del login de prueba tiene conectado WhatsApp? (para entender el ruteo del webhook) */
import { chromium } from "@playwright/test";
const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", process.env.TEST_SAAS_EMAIL);
await page.fill("#password", process.env.TEST_SAAS_PASSWORD);
await page.click('form button[type="submit"]');
await page.waitForTimeout(6000);
if (page.url().includes("/login")) { console.error("login falló"); process.exit(2); }
const api = page.request;
const conn = await (await api.get(`${BASE}/api/whatsapp/connection`)).json().catch(() => null);
console.log("CONNECTION (org del login):", JSON.stringify(conn));
const PNID = process.env.PHONE_NUMBER_ID || "";
console.log("PNID en env (últimos 4):", PNID ? "…" + PNID.slice(-4) : "(ausente)", "| len:", PNID.length);
await browser.close();
