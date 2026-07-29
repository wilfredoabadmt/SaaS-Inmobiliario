// @ts-check
/** Dispara un deploy en Coolify y espera a que el deployment termine (status via API). */
const URL = (process.env.COOLIFY_URL || "").replace(/\/$/, "");
const TOKEN = process.env.COOLIFY_API_TOKEN;
const h = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const appsBody = await (await fetch(`${URL}/api/v1/applications`, { headers: h })).json();
const apps = Array.isArray(appsBody) ? appsBody : appsBody?.data || [];
const app = apps.find((a) => /inmox-dev/.test(a?.fqdn || "") || /inmox/.test(a?.name || ""));
if (!app) {
  console.error("No encontré el recurso inmox-dev");
  process.exit(1);
}

const dep = await (await fetch(`${URL}/api/v1/deploy?uuid=${app.uuid}&force=false`, { headers: h })).json();
const depUuid = dep?.deployments?.[0]?.deployment_uuid;
console.log(`deploy disparado: ${depUuid}`);
if (!depUuid) {
  console.error("No obtuve deployment_uuid");
  process.exit(1);
}

const TERMINAL = ["finished", "failed", "error", "cancelled-by-force-rebuild"];
for (let i = 0; i < 70; i++) {
  await new Promise((r) => setTimeout(r, 15000));
  let status = "?";
  try {
    const body = await (await fetch(`${URL}/api/v1/deployments/${depUuid}`, { headers: h })).json();
    status = body?.status ?? body?.data?.status ?? "?";
  } catch {
    status = "err";
  }
  console.log(`[${(i + 1) * 15}s] deployment status=${status}`);
  if (TERMINAL.includes(status)) {
    console.log(`DONE: ${status}`);
    process.exit(status === "finished" ? 0 : 1);
  }
}
console.log("TIMEOUT");
process.exit(2);
