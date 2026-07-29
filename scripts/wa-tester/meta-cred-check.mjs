// @ts-check
/** Lee SOLO los campos de ruteo de meta_credentials (sin token cifrado) para el self-test. */
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const rows = await sql`SELECT phone_number_id, display_phone_number, organization_id, status FROM meta_credentials`;
  console.log(`meta_credentials: ${rows.length} fila(s)`);
  for (const r of rows) {
    console.log(`  pnid=${r.phone_number_id} | display=${r.display_phone_number} | status=${r.status} | org=${r.organization_id}`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
