// Prueba LIVE simple del loop de WhatsApp: envía UN mensaje desde el número personal
// (tester, vía Evolution) al número de plataforma, y verifica que (1) el webhook lo
// reciba (entrante persistido) y (2) el agente responda (saliente ai-generated).
// Respeta el guardarraíl del evolution-client (allowlist + 1 envío + anti-ráfaga).
//
// Uso: node --env-file=.env --env-file=.env.tunnel scripts/selftest/whatsapp-live.mjs
import postgres from "postgres";
import { sendText } from "../wa-tester/evolution-client.mjs";

const CONV_ID = "conv_2JTix-RXCcK404lm8ZwPI"; // conversación del número personal (tester)
const PLATFORM = (process.env.PLATFORM_TEST_NUMBER || "0000000000"); // +1 555-176-8947 (número de prueba de la plataforma)
const MESSAGE = "Hola, busco departamento en renta en la Roma o Condesa, ¿qué tienen disponible?";

const sql = postgres(process.env.DATABASE_URL, { ssl: false, max: 1 });
const fmt = (m) =>
  `[${m.direction}${m.ai_generated ? "/IA" : ""}${m.wa_type ? "/" + m.wa_type : ""}] ${(m.body ?? "(sin texto)").slice(0, 200)}`;

async function messages() {
  return sql`select id, direction, body, ai_generated, wa_type, created_at
             from message where conversation_id = ${CONV_ID} order by created_at asc`;
}

async function main() {
  console.log("== Prueba LIVE WhatsApp (1 mensaje, ida y vuelta) ==\n");

  const before = await messages();
  const baseInbound = before.filter((m) => m.direction === "inbound").length;
  const baseOutbound = before.filter((m) => m.direction === "outbound").length;
  console.log(`Estado previo: ${before.length} mensajes (in=${baseInbound}, out=${baseOutbound}).`);
  console.log(`Enviando como CLIENTE → plataforma: "${MESSAGE}"\n`);

  const res = await sendText(PLATFORM, MESSAGE);
  console.log("✅ Evolution aceptó el envío:", res?.key?.id ? `msgId=${res.key.id}` : JSON.stringify(res).slice(0, 120));

  // Poll: primero el entrante (webhook), luego la respuesta del agente.
  let gotInbound = false;
  let gotReply = false;
  let last = before;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    const now = await messages();
    last = now;
    const inb = now.filter((m) => m.direction === "inbound").length;
    const out = now.filter((m) => m.direction === "outbound").length;
    if (!gotInbound && inb > baseInbound) {
      gotInbound = true;
      console.log(`\n📥 [${(i + 1) * 6}s] Webhook recibió el entrante (in: ${baseInbound}→${inb}).`);
    }
    if (out > baseOutbound) {
      gotReply = true;
      console.log(`🤖 [${(i + 1) * 6}s] El agente respondió (out: ${baseOutbound}→${out}).`);
      break;
    }
    process.stdout.write(".");
  }

  console.log("\n\n--- Transcript de la conversación ---");
  for (const m of last.slice(-6)) console.log(fmt(m));

  console.log("\n--- Resultado ---");
  console.log(gotInbound ? "✅ Entrante recibido por el webhook (ngrok→local→DB)" : "❌ El entrante NO llegó al webhook");
  console.log(gotReply ? "✅ El agente respondió (saliente persistido)" : "⚠️ El agente no respondió aún (revisa logs)");

  await sql.end({ timeout: 5 });
  process.exit(gotInbound ? 0 : 1);
}

main().catch(async (e) => {
  console.error("💥 ERROR:", e.message);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
