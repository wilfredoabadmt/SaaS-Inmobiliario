// Dump de los últimos mensajes de la conversación de prueba (para depurar el agente).
import { chromium } from "@playwright/test";
const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", process.env.TEST_SAAS_EMAIL);
await page.fill("#password", process.env.TEST_SAAS_PASSWORD);
await page.click('form button[type="submit"]');
await page.waitForTimeout(6000);
const api = page.request;
const { conversations = [] } = await (await api.get(`${BASE}/api/conversations`)).json();
const conv = conversations.find((c) => (c.clientPhone || "").replace(/\D/g, "").endsWith(((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))) || conversations[0];
const { messages = [] } = await (await api.get(`${BASE}/api/conversations/${conv.id}/messages`)).json();
console.log(`conv ${conv.id} · total ${messages.length}`);
messages.slice(-8).forEach((m) => console.log(`  [${m.direction}${m.aiGenerated ? "/IA" : ""}] ${new Date(m.createdAt).toLocaleTimeString("es-MX")}  ${JSON.stringify(m.body)?.slice(0, 90)}`));
await browser.close();
