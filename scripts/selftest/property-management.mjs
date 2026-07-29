// Self-test E2E de la feature 007 (administración de propiedades) contra la app local
// + BD dev. Registra 2 tenants aislados (NO toca datos demo), ejerce el flujo completo
// (US1-US5) por los endpoints reales + el camino infeliz + aislamiento cross-tenant.
// Limpia sus propios tenants al final.
//
// Uso: node --env-file=.env.tunnel scripts/selftest/property-management.mjs
import postgres from "postgres";
import { nanoid } from "nanoid";

const BASE = "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL, { ssl: false, max: 2 });

let pass = 0;
let fail = 0;
const fails = [];
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    fails.push(name);
    console.log(`  ❌ ${name} ${extra}`);
  }
}

/** fetch con jar de cookies (objeto name→value). */
async function req(jar, method, path, body, extraHeaders = {}) {
  const headers = { Origin: BASE, ...extraHeaders };
  const cookie = Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (cookie) headers.Cookie = cookie;
  let bodyInit;
  if (body instanceof Uint8Array) {
    bodyInit = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyInit = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: bodyInit, redirect: "manual" });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  let json = null;
  const txt = await res.text();
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {
    json = txt;
  }
  return { status: res.status, json };
}

/** Registra un tenant (owner) y deja la org activa. Devuelve { jar, orgId, email }. */
async function registerTenant(label) {
  const jar = {};
  const email = `selftest-${label}-${nanoid(8).toLowerCase()}@inmox.test`;
  const agency = `SelfTest ${label} ${nanoid(5)}`;
  const su = await req(jar, "POST", "/api/auth/sign-up/email", {
    email,
    password: "selftest-Pass123",
    name: agency,
  });
  if (su.status >= 400) throw new Error(`sign-up ${label} falló: ${su.status} ${JSON.stringify(su.json)}`);
  const slug = `selftest-${label}-${nanoid(8).toLowerCase()}`;
  const org = await req(jar, "POST", "/api/auth/organization/create", { name: agency, slug });
  const orgId = org.json?.id ?? org.json?.organization?.id;
  if (!orgId) throw new Error(`org create ${label} falló: ${org.status} ${JSON.stringify(org.json)}`);
  await req(jar, "POST", "/api/auth/organization/set-active", { organizationId: orgId });
  return { jar, orgId, email };
}

const created = { orgIds: [], userEmails: [] };

async function main() {
  console.log("== Self-test 007: administración de propiedades ==\n");

  // --- Setup: dos tenants aislados ---
  console.log("Setup: registrando tenants A y B…");
  const A = await registerTenant("a");
  const B = await registerTenant("b");
  created.orgIds.push(A.orgId, B.orgId);
  created.userEmails.push(A.email, B.email);
  console.log(`  org A=${A.orgId}  org B=${B.orgId}\n`);

  // ===== US1: crear / editar =====
  console.log("US1 — crear/editar");
  const createBody = {
    operationType: "venta",
    propertyType: "departamento",
    title: "Depto self-test Del Valle",
    price: 4200000,
    currency: "MXN",
    neighborhood: "Del Valle",
    city: "CDMX",
    bedrooms: 2,
    bathrooms: 2,
  };
  const c = await req(A.jar, "POST", "/api/properties", createBody);
  check("POST crea (201)", c.status === 201, `→ ${c.status}`);
  const propId = c.json?.id;
  check("devuelve id prop_…", typeof propId === "string" && propId.startsWith("prop_"));

  const list1 = await req(A.jar, "GET", "/api/properties");
  check("aparece en el inventario", (list1.json?.properties ?? []).some((p) => p.id === propId));

  const det1 = await req(A.jar, "GET", `/api/properties/${propId}`);
  check("GET detalle 200 + precio", det1.status === 200 && det1.json?.price === "4200000.00", `→ ${det1.status}`);

  const patch = await req(A.jar, "PATCH", `/api/properties/${propId}`, { price: 3990000 });
  check("PATCH edita precio", patch.status === 200 && patch.json?.property?.price === "3990000.00");
  const det2 = await req(A.jar, "GET", `/api/properties/${propId}`);
  check("edición persiste", det2.json?.price === "3990000.00");

  // ===== US2: estatus / archivar =====
  console.log("US2 — estatus/archivar");
  const st = await req(A.jar, "PATCH", `/api/properties/${propId}/status`, { status: "apartada" });
  check("PATCH estatus apartada", st.status === 200 && st.json?.status === "apartada");

  const arch = await req(A.jar, "POST", `/api/properties/${propId}/archive`, { archived: true });
  check("archivar set archivedAt", arch.status === 200 && Boolean(arch.json?.archivedAt));
  const activeList = await req(A.jar, "GET", "/api/properties?archived=false");
  check("archivada NO está en activas", !(activeList.json?.properties ?? []).some((p) => p.id === propId));
  const archList = await req(A.jar, "GET", "/api/properties?archived=true");
  check("archivada SÍ en archivadas", (archList.json?.properties ?? []).some((p) => p.id === propId));
  const unarch = await req(A.jar, "POST", `/api/properties/${propId}/archive`, { archived: false });
  check("desarchivar (archivedAt null)", unarch.status === 200 && unarch.json?.archivedAt === null);
  const det3 = await req(A.jar, "GET", `/api/properties/${propId}`);
  check("estatus se conserva tras desarchivar", det3.json?.status === "apartada");
  // vuelve a disponible para que el matching directo aplique
  await req(A.jar, "PATCH", `/api/properties/${propId}/status`, { status: "disponible" });

  // ===== US3: fotos (sign → PUT R2 → confirm; make_main; delete) =====
  console.log("US3 — fotos (subida prefirmada a R2)");
  const fakePng = new Uint8Array(1500);
  fakePng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // firma PNG + relleno
  async function uploadPhoto() {
    const sign = await req(A.jar, "POST", `/api/properties/${propId}/photos`, {
      phase: "sign",
      contentType: "image/png",
      sizeBytes: fakePng.byteLength,
    });
    if (sign.status !== 200) return { ok: false, sign };
    const put = await fetch(sign.json.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: fakePng,
    });
    if (!put.ok) return { ok: false, put: put.status };
    const conf = await req(A.jar, "POST", `/api/properties/${propId}/photos`, {
      phase: "confirm",
      photoId: sign.json.photoId,
      storageKey: sign.json.storageKey,
      contentType: "image/png",
      sizeBytes: fakePng.byteLength,
    });
    return { ok: conf.status === 201, conf, photoId: sign.json.photoId };
  }
  const up1 = await uploadPhoto();
  check("sube foto 1 (sign→PUT R2→confirm 201)", up1.ok, JSON.stringify(up1.conf?.json ?? up1));
  const up2 = await uploadPhoto();
  check("sube foto 2", up2.ok);
  const photosAfter2 = up2.conf?.json?.photos ?? [];
  check("galería tiene 2 fotos", photosAfter2.length === 2);
  check("primera foto es principal (sortOrder 0)", photosAfter2[0]?.isMain === true && photosAfter2[0]?.sortOrder === 0);

  // marcar la 2da como principal
  const mkMain = await req(A.jar, "PATCH", `/api/properties/${propId}/photos/${up2.photoId}`, { action: "make_main" });
  const newMain = (mkMain.json?.photos ?? []).find((p) => p.isMain);
  check("make_main mueve la foto 2 al frente", mkMain.status === 200 && newMain?.id === up2.photoId);

  // eliminar la principal → la otra pasa a principal
  const del = await req(A.jar, "DELETE", `/api/properties/${propId}/photos/${up2.photoId}`);
  check("DELETE principal renumera (queda 1, principal)", del.status === 200 && del.json?.photos?.length === 1 && del.json.photos[0].isMain === true);

  // ===== US5 + US4: requisitos manuales → match inverso =====
  console.log("US5/US4 — requisitos manuales + match inverso");
  // fixture: un cliente en org A (no hay UI de alta de cliente en este alcance)
  const clientId = `cli_${nanoid()}`;
  await sql`insert into "client" (id, organization_id, name, phone) values (${clientId}, ${A.orgId}, ${"Cliente SelfTest"}, ${"+52" + nanoid(10)})`;
  const reqPut = await req(A.jar, "PUT", `/api/clients/${clientId}/requirements`, {
    operation: "venta",
    budgetMin: 3000000,
    budgetMax: 5000000,
    zone: "Del Valle",
    propertyType: "departamento",
    bedrooms: 2,
  });
  check("PUT requisitos manuales 200 (source manual)", reqPut.status === 200 && reqPut.json?.requirements?.source === "manual");

  const mc1 = await req(A.jar, "GET", `/api/properties/${propId}/matching-clients`);
  const hit = (mc1.json?.clients ?? []).find((x) => x.clientId === clientId);
  check("match inverso lista al cliente compatible", Boolean(hit), JSON.stringify(mc1.json));
  check("match con pct alto (>60)", (hit?.pct ?? 0) > 60, `pct=${hit?.pct}`);

  // bajar presupuesto fuera de rango → pct baja
  await req(A.jar, "PUT", `/api/clients/${clientId}/requirements`, { budgetMax: 1000000 });
  const mc2 = await req(A.jar, "GET", `/api/properties/${propId}/matching-clients`);
  const hit2 = (mc2.json?.clients ?? []).find((x) => x.clientId === clientId);
  check("tras bajar presupuesto, pct baja", (hit2?.pct ?? 100) < (hit?.pct ?? 0), `${hit?.pct} → ${hit2?.pct}`);

  // match inverso con propiedad archivada → vacío
  await req(A.jar, "POST", `/api/properties/${propId}/archive`, { archived: true });
  const mc3 = await req(A.jar, "GET", `/api/properties/${propId}/matching-clients`);
  check("propiedad archivada → match inverso vacío", (mc3.json?.clients ?? []).length === 0);
  await req(A.jar, "POST", `/api/properties/${propId}/archive`, { archived: false });

  // ===== Camino infeliz =====
  console.log("Camino infeliz");
  const bad1 = await req(A.jar, "POST", "/api/properties", { ...createBody, price: -1 });
  check("precio -1 → 422", bad1.status === 422, `→ ${bad1.status}`);
  const bad2 = await req(A.jar, "POST", "/api/properties", { operationType: "venta" });
  check("faltan campos requeridos → 422", bad2.status === 422, `→ ${bad2.status}`);
  const bad3 = await req(A.jar, "POST", `/api/properties/${propId}/photos`, { phase: "sign", contentType: "application/pdf", sizeBytes: 2000 });
  check("foto pdf → 422", bad3.status === 422, `→ ${bad3.status}`);
  const bad4 = await req(A.jar, "POST", `/api/properties/${propId}/photos`, { phase: "sign", contentType: "image/png", sizeBytes: 500 });
  check("foto < 1000 bytes → 422", bad4.status === 422, `→ ${bad4.status}`);
  const bad5 = await req(A.jar, "PUT", `/api/clients/${clientId}/requirements`, { budgetMin: 5000000, budgetMax: 1000000 });
  check("budgetMin>budgetMax → 422", bad5.status === 422, `→ ${bad5.status}`);

  // ===== Aislamiento cross-tenant (org B no ve nada de A) =====
  console.log("Aislamiento (org B contra recursos de A)");
  const iso1 = await req(B.jar, "GET", `/api/properties/${propId}`);
  check("B GET prop de A → 404", iso1.status === 404, `→ ${iso1.status}`);
  const iso2 = await req(B.jar, "PATCH", `/api/properties/${propId}`, { price: 1 });
  check("B PATCH prop de A → 404", iso2.status === 404, `→ ${iso2.status}`);
  const iso3 = await req(B.jar, "POST", `/api/properties/${propId}/archive`, { archived: true });
  check("B archivar prop de A → 404", iso3.status === 404, `→ ${iso3.status}`);
  const iso4 = await req(B.jar, "GET", `/api/properties/${propId}/matching-clients`);
  check("B match-clients de A → 404", iso4.status === 404, `→ ${iso4.status}`);
  const iso5 = await req(B.jar, "PUT", `/api/clients/${clientId}/requirements`, { operation: "venta" });
  check("B edita requisitos de cliente de A → 404", iso5.status === 404, `→ ${iso5.status}`);
  const iso6 = await req(B.jar, "GET", "/api/properties");
  check("inventario de B NO contiene la prop de A", !(iso6.json?.properties ?? []).some((p) => p.id === propId));

  console.log(`\n== Resultado: ${pass} ✅  /  ${fail} ❌ ==`);
  if (fail) console.log("Fallos:", fails.join(" | "));
}

async function cleanup() {
  // Borra los tenants de prueba (cascada de dominio por FK org). Sesiones/usuarios aparte.
  try {
    for (const email of created.userEmails) {
      await sql`delete from "session" where user_id in (select id from "user" where email = ${email})`;
    }
    for (const orgId of created.orgIds) {
      await sql`delete from "organization" where id = ${orgId}`;
    }
    for (const email of created.userEmails) {
      await sql`delete from "account" where user_id in (select id from "user" where email = ${email})`;
      await sql`delete from "user" where email = ${email}`;
    }
    console.log("🧹 tenants de prueba eliminados.");
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
