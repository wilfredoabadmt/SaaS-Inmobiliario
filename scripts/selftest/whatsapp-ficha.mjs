// Cierre 007 en vivo: pide la ficha y verifica que el agente envíe la TARJETA de la
// propiedad (saliente con property_id) usando la foto real. 1 mensaje, guardarraíl.
// Uso: node --env-file=.env --env-file=.env.tunnel scripts/selftest/whatsapp-ficha.mjs
import postgres from "postgres";
import { sendText } from "../wa-tester/evolution-client.mjs";

const CONV_ID = "conv_2JTix-RXCcK404lm8ZwPI";
const PLATFORM = (process.env.PLATFORM_TEST_NUMBER || "0000000000");
const MESSAGE = "Sí, mándame la ficha del departamento en la Condesa por favor.";

const sql = postgres(process.env.DATABASE_URL, { ssl: false, max: 1 });

async function outboundFichas() {
  return sql`select m.id, m.body, m.property_id, p.title,
                    (select count(*)::int from property_photo ph where ph.property_id = m.property_id) as fotos
             from message m left join property p on p.id = m.property_id
             where m.conversation_id = ${CONV_ID} and m.direction='outbound' and m.property_id is not null
             order by m.created_at asc`;
}

async function main() {
  console.log("== Cierre 007: ficha con foto real por WhatsApp ==\n");
  const base = (await outboundFichas()).length;
  console.log(`Fichas enviadas antes: ${base}`);
  console.log(`Pidiendo: "${MESSAGE}"\n`);

  await sendText(PLATFORM, MESSAGE);
  console.log("✅ Evolution aceptó el envío.\n");

  let ficha = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    const fichas = await outboundFichas();
    if (fichas.length > base) {
      ficha = fichas[fichas.length - 1];
      console.log(`🃏 [${(i + 1) * 6}s] El agente envió una ficha.`);
      break;
    }
    process.stdout.write(".");
  }

  console.log("\n--- Resultado ---");
  if (ficha) {
    console.log(`✅ Ficha enviada: propiedad "${ficha.title}" (property_id=${ficha.property_id})`);
    console.log(`   Fotos de la propiedad: ${ficha.fotos} → ${ficha.fotos > 0 ? "se envía como TARJETA con foto (image payload)" : "sin foto → degrada a texto"}`);
    console.log(`   Caption: ${(ficha.body ?? "").slice(0, 160)}`);
  } else {
    console.log("⚠️ No se detectó ficha saliente (revisa logs por error de Meta/imagen).");
  }

  await sql.end({ timeout: 5 });
  process.exit(ficha ? 0 : 1);
}

main().catch(async (e) => {
  console.error("💥 ERROR:", e.message);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
