// @ts-check
/** Espera a que el código nuevo (469c245) esté vivo: /api/pipeline/members es ruta nueva → 401. */
const BASE = process.env.TEST_SAAS_URL || "https://inmox-dev.kevinbelier.cloud";
for (let i = 0; i < 80; i++) {
  let status = 0;
  try {
    status = (await fetch(`${BASE}/api/pipeline/members`)).status;
  } catch {
    status = -1;
  }
  console.log(`[${i * 15}s] /api/pipeline/members → ${status}`);
  if (status === 401) {
    console.log("NEW CODE LIVE (401 = ruta existe, guard activo)");
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 15000));
}
console.log("TIMEOUT esperando el deploy");
process.exit(2);
