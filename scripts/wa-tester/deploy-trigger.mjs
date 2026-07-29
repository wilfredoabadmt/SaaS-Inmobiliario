// @ts-check
/** Dispara un deploy del recurso de inmox-dev vía la API de Coolify (.env). */
const URL = (process.env.COOLIFY_URL || "").replace(/\/$/, "");
const TOKEN = process.env.COOLIFY_API_TOKEN;
if (!URL || !TOKEN) {
  console.error("Faltan COOLIFY_URL / COOLIFY_API_TOKEN en .env");
  process.exit(2);
}
const h = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const appsRes = await fetch(`${URL}/api/v1/applications`, { headers: h });
const appsBody = await appsRes.json();
const apps = Array.isArray(appsBody) ? appsBody : appsBody?.data || [];
const app = apps.find(
  (a) => /inmox-dev/.test(a?.fqdn || "") || /inmox/.test(a?.name || a?.description || ""),
);
if (!app) {
  console.error(`No encontré el recurso inmox-dev (apps=${apps.length}).`);
  console.error(apps.map((a) => `${a?.uuid} ${a?.name} ${a?.fqdn} branch=${a?.git_branch}`).join("\n"));
  process.exit(1);
}
console.log(`app uuid=${app.uuid} name=${app.name} fqdn=${app.fqdn} branch=${app.git_branch}`);

const depRes = await fetch(`${URL}/api/v1/deploy?uuid=${app.uuid}&force=false`, { headers: h });
const depBody = await depRes.json().catch(() => null);
console.log(`deploy trigger status=${depRes.status} body=${JSON.stringify(depBody)}`);
