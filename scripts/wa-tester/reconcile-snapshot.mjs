// @ts-check
/**
 * Reconcilia drizzle/meta/0008_snapshot.json (ausente): regenera el snapshot dejando que
 * drizzle-kit genere la migración 0008 (auto-respondiendo el prompt de rename por stdin) y luego
 * RESTAURA el .sql seed-then-map hecho a mano. El snapshot representa el esquema final sin importar
 * la respuesta al prompt, así que queda correcto. Backup previo en /tmp/drizzle-backup.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";

const J = "drizzle/meta/_journal.json";
const SQL = "drizzle/0008_sales_pipeline.sql";
const SQL_BACKUP = "/tmp/drizzle-backup/0008_sales_pipeline.sql";

// 1. Quitar la entrada idx 8 del journal para que generate cree 0008 de cero.
const journal = JSON.parse(readFileSync(J, "utf8"));
journal.entries = journal.entries.filter((e) => e.idx !== 8);
writeFileSync(J, JSON.stringify(journal, null, 2));
console.log(`journal: quitada idx 8 (quedan ${journal.entries.length} entradas)`);

// 2. Borrar el .sql 0008 para que generate lo cree limpio (lo restauro al final).
if (existsSync(SQL)) rmSync(SQL);

// 3. Generar con auto-respuesta al prompt de rename.
const env = { ...process.env, DATABASE_URL: "postgres://localhost:5432/placeholder" };
const child = spawn("pnpm", ["exec", "drizzle-kit", "generate", "--name", "sales_pipeline"], {
  env,
  shell: true,
});
let lastAnswer = 0;
function onData(buf) {
  const s = buf.toString();
  process.stdout.write(s);
  if (/renamed|create column|❯/.test(s) && Date.now() - lastAnswer > 400) {
    lastAnswer = Date.now();
    setTimeout(() => child.stdin.write("\n"), 250);
  }
}
child.stdout.on("data", onData);
child.stderr.on("data", onData);

const killer = setTimeout(() => {
  console.log("TIMEOUT — matando drizzle-kit");
  child.kill();
}, 60000);

child.on("exit", (code) => {
  clearTimeout(killer);
  console.log(`\ndrizzle-kit exit=${code}`);
  // 4. Restaurar mi .sql seed-then-map (drizzle generó uno DDL que descartamos).
  if (existsSync(SQL_BACKUP)) {
    writeFileSync(SQL, readFileSync(SQL_BACKUP, "utf8"));
    console.log("restaurado mi 0008_sales_pipeline.sql (seed-then-map)");
  }
  const snapOk = existsSync("drizzle/meta/0008_snapshot.json");
  const jrnl = JSON.parse(readFileSync(J, "utf8"));
  const has8 = jrnl.entries.some((e) => e.idx === 8);
  console.log(`0008_snapshot.json existe: ${snapOk} | journal idx8: ${has8}`);
  process.exit(snapOk && has8 ? 0 : 1);
});
