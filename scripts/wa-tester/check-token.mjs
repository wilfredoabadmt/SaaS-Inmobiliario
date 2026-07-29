// Valida META_SYSTEM_USER_TOKEN contra Graph API. Solo lectura.
// Imprime SOLO campos no sensibles (validez, expiración, permisos, números).
// NUNCA imprime el token.
const V = process.env.META_GRAPH_API_VERSION || "v21.0";
const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;

if (!TOKEN || !APP_ID || !APP_SECRET) {
  console.error("Faltan META_SYSTEM_USER_TOKEN / META_APP_ID / META_APP_SECRET");
  process.exit(1);
}

const g = async (path) => {
  const res = await fetch(`https://graph.facebook.com/${V}/${path}`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
};

// 1) debug_token
const dbg = await g(
  `debug_token?input_token=${encodeURIComponent(TOKEN)}&access_token=${APP_ID}|${APP_SECRET}`,
);
const d = dbg.body?.data ?? {};
console.log("— debug_token —");
console.log("  is_valid:", d.is_valid);
console.log("  app_id:", d.app_id);
console.log("  type:", d.type);
console.log(
  "  expires_at:",
  d.expires_at === 0 ? "0 (NUNCA expira ✅)" : new Date((d.expires_at ?? 0) * 1000).toISOString(),
);
console.log(
  "  data_access_expires_at:",
  d.data_access_expires_at === 0 ? "0" : new Date((d.data_access_expires_at ?? 0) * 1000).toISOString(),
);
console.log("  scopes:", (d.scopes ?? []).join(", "));
if (dbg.body?.error) console.log("  error:", JSON.stringify(dbg.body.error));

// 2) Descubrir WABAs desde los granular_scopes del token (target_ids).
console.log("\n— WABAs en granular_scopes —");
const wabaIds = new Set();
for (const gs of d.granular_scopes ?? []) {
  if (/whatsapp_business/.test(gs.scope) && Array.isArray(gs.target_ids)) {
    console.log(`  ${gs.scope}: ${gs.target_ids.join(", ")}`);
    gs.target_ids.forEach((id) => wabaIds.add(id));
  }
}
if (wabaIds.size === 0) console.log("  (sin target_ids; el token puede no estar acotado a un WABA)");

// 3) Para cada WABA, listar sus números (phone_number_id + display).
console.log("\n— Números por WABA —");
for (const waba of wabaIds) {
  const pn = await g(
    `${waba}/phone_numbers?fields=id,display_phone_number,verified_name,platform_type,code_verification_status&access_token=${encodeURIComponent(TOKEN)}`,
  );
  if (!pn.ok) {
    console.log(`  WABA ${waba}: error ${JSON.stringify(pn.body?.error ?? pn.body)}`);
    continue;
  }
  console.log(`  WABA ${waba}:`);
  for (const p of pn.body?.data ?? []) {
    console.log(
      `     phone_number_id=${p.id} · ${p.display_phone_number} · ${p.verified_name ?? ""} · ${p.platform_type ?? ""}`,
    );
  }
}
