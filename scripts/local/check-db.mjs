// Valida que .env.tunnel conecta a la BD de inmox-dev (datos presentes + migraciones).
// Uso: node --env-file=.env.tunnel scripts/local/check-db.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url || url.includes("__PEGA_AQUI")) {
  console.error("❌ Falta el password en DATABASE_URL (pégalo en .env.tunnel y reintenta).");
  process.exit(1);
}

// Coolify Postgres público no usa TLS (verificado en deploys previos).
const sql = postgres(url, { ssl: false, max: 1, connect_timeout: 10 });
try {
  const [{ now }] = await sql`select now()`;
  const [{ n: tables }] = await sql`
    select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
  const [{ n: props }] = await sql`select count(*)::int as n from property`;
  const [{ n: convs }] = await sql`select count(*)::int as n from conversation`;
  const [{ n: creds }] = await sql`select count(*)::int as n from meta_credentials`;
  console.log(`✅ Conexión OK @ ${now.toISOString()}`);
  console.log(
    `   tablas(public)=${tables} · property=${props} · conversation=${convs} · meta_credentials=${creds}`,
  );
  if (tables < 15) console.log("⚠️ Pocas tablas: ¿migraciones sin aplicar?");
  if (creds === 0) console.log("⚠️ Sin meta_credentials: el webhook no resolverá la org (revisa el mapeo del número).");
  if (props === 0) console.log("⚠️ Sin propiedades: el matching saldrá vacío (siembra inventario).");
} catch (e) {
  console.error("❌ FALLA de conexión:", e instanceof Error ? e.message : String(e));
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
