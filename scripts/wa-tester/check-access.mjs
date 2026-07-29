// @ts-check
/**
 * Confirma (READ-ONLY) que tengo acceso al WhatsApp del tester vía Evolution API.
 * No envía ningún mensaje. También verifica la lista blanca dura.
 *
 * Uso:  node scripts/wa-tester/check-access.mjs
 * (carga .env si lo corres con: node --env-file=.env scripts/wa-tester/check-access.mjs)
 */

import { confirmAccess, _internal } from "./evolution-client.mjs";

async function main() {
  console.log("— Guardrail —");
  console.log(`  Único destino permitido (últimos 10): ${_internal.ALLOWED_LAST10}`);
  console.log(`  Gap mínimo entre envíos: ${_internal.MIN_GAP_MS / 1000}s · tope/corrida: ${_internal.MAX_PER_RUN}`);
  console.log(
    `  Prueba allowlist → tu TESTER_WHATSAPP_NUMBER: ${_internal.isAllowed("52" + ((process.env.TESTER_WHATSAPP_NUMBER || "").replace(/\D/g, "").slice(-10) || "0000000000"))}`,
  );
  console.log(`  Prueba allowlist → otro número:   ${_internal.isAllowed("5215512345678")} (debe ser false)`);

  console.log("\n— Conexión Evolution —");
  try {
    const state = await confirmAccess();
    console.log("  OK:", JSON.stringify(state));
  } catch (e) {
    console.error("  ERROR:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

main();
