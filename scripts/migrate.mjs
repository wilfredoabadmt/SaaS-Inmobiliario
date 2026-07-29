// Migrador de PRODUCCIÓN. Aplica las migraciones de `drizzle/` usando el migrador de
// `drizzle-orm` (NO necesita `drizzle-kit`, que es devDependency y no está en la imagen
// standalone). Se bundlea con esbuild en el build (ver Dockerfile) → un único archivo
// auto-contenido, y se ejecuta como Pre-Deployment Command en Coolify: `node migrate.mjs`.
//
// La carpeta `drizzle/` se copia junto al script en la imagen; se resuelve relativa al
// propio script para no depender del cwd. Falla con exit!=0 si la migración no aplica,
// para que el deploy se detenga antes de arrancar con un esquema inconsistente.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL no definido — abortando.");
  process.exit(1);
}

const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "drizzle");

// `onnotice` silencia los NOTICE inofensivos de Postgres ("... already exists, skipping").
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  console.log("[migrate] aplicando migraciones pendientes desde:", migrationsFolder);
  await migrate(drizzle(sql), { migrationsFolder });
  console.log("[migrate] OK — esquema al día.");
} catch (e) {
  console.error("[migrate] FALLÓ:", e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
