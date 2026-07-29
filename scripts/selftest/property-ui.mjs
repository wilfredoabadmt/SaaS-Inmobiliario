// Self-test de UI (navegador real, Playwright) de la feature 007: valida el CORS de R2
// end-to-end (subida de foto desde el navegador) + que los componentes reales funcionan
// (registro → /properties → form de alta → hoja de detalle → editor de fotos).
// Registra un tenant de prueba y lo limpia al final.
//
// Uso: node --env-file=.env.tunnel scripts/selftest/property-ui.mjs
import { chromium } from "@playwright/test";
import postgres from "postgres";
import { nanoid } from "nanoid";

const BASE = "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL, { ssl: false, max: 1 });
const email = `selftest-ui-${nanoid(8).toLowerCase()}@inmox.test`;

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

async function main() {
  console.log("== Self-test UI 007 (navegador real + CORS R2) ==\n");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const corsErrors = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/CORS|Access-Control|blocked by/i.test(t)) corsErrors.push(t);
  });

  // --- Registro (UI real) ---
  await page.goto(`${BASE}/register`);
  await page.fill("#email", email);
  await page.fill("#password", "selftest-Pass123");
  await page.fill("#agencyName", `SelfTest UI ${nanoid(5)}`);
  await page.click('button:has-text("Crear cuenta")');
  await page.waitForURL("**/inbox", { timeout: 30000 });
  check("registro → dashboard", page.url().includes("/inbox"));

  // --- Crear propiedad por el form real ---
  await page.goto(`${BASE}/properties`);
  await page.click('button:has-text("Nueva propiedad")');
  await page.getByPlaceholder("Depto en Del Valle").fill("Depto UI self-test");
  await page.getByPlaceholder("4200000").fill("3500000");
  await page.click('button:has-text("Crear propiedad")');
  // la tarjeta aparece
  await page.waitForSelector('text=Depto UI self-test', { timeout: 15000 });
  check("alta por el form aparece en el inventario", true);

  // --- Abrir detalle ---
  await page.click('text=Depto UI self-test');
  await page.waitForSelector('button:has-text("Subir foto")', { timeout: 15000 });
  check("la tarjeta despliega el detalle con editor de fotos", true);

  // --- Subir foto (PUT directo navegador → R2; valida CORS) ---
  const png = Buffer.alloc(1500);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await page.setInputFiles('input[type="file"]', {
    name: "test.png",
    mimeType: "image/png",
    buffer: png,
  });
  // espera a que aparezca la miniatura (img dentro de la galería) o el contador "Fotos (1)"
  let uploaded = false;
  try {
    await page.waitForSelector("text=/Fotos \\(1\\)/", { timeout: 20000 });
    uploaded = true;
  } catch {
    uploaded = false;
  }
  check("subida de foto desde el navegador OK (CORS R2 correcto)", uploaded);
  check("sin errores CORS en consola", corsErrors.length === 0, corsErrors[0] ?? "");

  console.log(`\n== Resultado UI: ${pass} ✅  /  ${fail} ❌ ==`);
  await browser.close();
}

async function cleanup() {
  try {
    await sql`delete from "session" where user_id in (select id from "user" where email = ${email})`;
    await sql`delete from "organization" where id in (
      select m.organization_id from "member" m join "user" u on u.id = m.user_id where u.email = ${email}
    )`;
    await sql`delete from "account" where user_id in (select id from "user" where email = ${email})`;
    await sql`delete from "user" where email = ${email}`;
    console.log("🧹 tenant de prueba UI eliminado.");
  } catch (e) {
    console.error("⚠️ cleanup parcial:", e.message);
  }
}

main()
  .catch((e) => {
    console.error("\n💥 ERROR:", e.message);
    fail++;
  })
  .finally(async () => {
    await cleanup();
    await sql.end({ timeout: 5 });
    process.exit(fail > 0 ? 1 : 0);
  });
