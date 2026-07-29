import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "@/lib/db/schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: Database | null = null;

/**
 * Cliente Drizzle (lazy singleton). postgres-js no abre conexión hasta la primera
 * query, así que importar este módulo no conecta a la DB (build-safe).
 */
export function getDb(): Database {
  if (dbInstance) return dbInstance;
  const { DATABASE_URL } = getEnv();
  client = postgres(DATABASE_URL, { prepare: false });
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

/** Cierra la conexión (útil en scripts/tests). */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}
