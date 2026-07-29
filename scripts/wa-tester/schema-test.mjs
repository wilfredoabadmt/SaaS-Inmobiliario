// Verifica que la normalización JS del agente acepta el JSON problemático del modelo.
import { z } from "zod";

const agentSchema = z.object({
  reply: z.string().min(1).max(2000),
  requirements: z.record(z.string(), z.unknown()).nullish(),
  action: z.record(z.string(), z.unknown()).nullish(),
});

const OPERATIONS = ["renta", "venta"];
const PROPERTY_TYPES = ["casa", "departamento", "local", "terreno"];
const ACTION_TYPES = ["none", "send_sheet", "schedule_visit", "handoff"];
const lc = (v) => (typeof v === "string" ? v.toLowerCase().trim() : "");
const asEnum = (v, allowed) => (allowed.includes(lc(v)) ? lc(v) : undefined);
const asNum = (v) => {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const asStr = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const normReq = (raw) => {
  const r = raw ?? {};
  return {
    operation: asEnum(r.operation, OPERATIONS), budgetMin: asNum(r.budgetMin), budgetMax: asNum(r.budgetMax),
    zone: asStr(r.zone), propertyType: asEnum(r.propertyType, PROPERTY_TYPES),
    bedrooms: asNum(r.bedrooms), bathrooms: asNum(r.bathrooms), notes: asStr(r.notes),
  };
};
const normAction = (raw) => {
  const o = raw ?? {}; const p = o.parameters ?? o.args ?? {};
  return {
    type: asEnum(o.type ?? o.name ?? o.action, ACTION_TYPES) ?? "none",
    propertyId: asStr(o.propertyId ?? p.propertyId ?? p.property_id) ?? null,
    whenISO: asStr(o.whenISO ?? o.when ?? p.whenISO ?? p.when) ?? null,
    reason: asStr(o.reason ?? p.reason) ?? null,
  };
};

const problematic = {
  reply: "¡Hola! Claro que sí...",
  requirements: { operation: "renta", budgetLabel: "Hasta $28,000", budgetMax: 28000, zone: "Polanco", propertyType: "Departamento", bedrooms: 2 },
  action: { name: "send_sheet", parameters: { propertyId: "p1" } },
};

const parsed = agentSchema.safeParse(problematic);
if (!parsed.success) {
  console.log("❌ schema laxo rechazó:", JSON.stringify(parsed.error.issues));
  process.exit(1);
}
console.log("✅ schema laxo OK");
console.log("requirements normalizados:", JSON.stringify(normReq(parsed.data.requirements)));
console.log("action normalizada:", JSON.stringify(normAction(parsed.data.action)));
