import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/health — verifica conexión a la base de datos (healthcheck de Coolify). */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" }, { status: 200 });
  } catch {
    return Response.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
