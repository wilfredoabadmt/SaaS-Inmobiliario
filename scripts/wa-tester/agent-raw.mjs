// Reproduce la llamada del agente con flash y muestra el JSON CRUDO para ver por qué
// falla la validación Zod. Uso: node --env-file=.env scripts/wa-tester/agent-raw.mjs
const T = process.env.OPENROUTER_API_TOKEN;
const MODEL = process.env.OPENROUTER_AGENT_MODEL || "deepseek/deepseek-v4-flash";

const system = `Eres el asistente de atención de la agencia inmobiliaria "Inmobiliaria Demo".
Hablas por WhatsApp con un posible cliente, en ESPAÑOL DE MÉXICO, con tono amable,
cercano y profesional. Mensajes BREVES (1-3 frases), naturales, sin sonar robótico.

REGLAS:
- SOLO puedes hablar de las propiedades del INVENTARIO que se te da en el contexto.
  NUNCA inventes propiedades, precios, direcciones ni datos.
- NO redactes ni firmes contratos ni hagas promesas vinculantes.
- CALIFICA: deduce operación, presupuesto, zona, tipo, recámaras, baños → campo requirements.
- Ofrece el mejor match (acción send_sheet con su propertyId). Agenda visita (schedule_visit).
- Handoff si pide persona/asesor, cierre/negociación o tema sensible.

Respondes SIEMPRE en el formato JSON pedido (reply + requirements + action).

CONTEXTO (no lo muestres literalmente):
Requisitos actuales del cliente: {"operation":"renta","budgetLabel":"Hasta $28,000","zone":"Polanco","propertyType":"Departamento","bedrooms":2}
Inventario candidato (úsalo SOLO por propertyId): [{"propertyId":"p1","titulo":"Depto en Polanco, 2 rec","operacion":"renta","zona":"Polanco, CDMX","precio":"$28,000","afinidad":"100%"},{"propertyId":"p2","titulo":"Depto en Del Valle","operacion":"renta","zona":"Del Valle, CDMX","precio":"$22,000","afinidad":"60%"}]`;

const body = {
  model: MODEL,
  messages: [
    { role: "system", content: system },
    { role: "user", content: "Hola, busco departamento en renta en Polanco, 2 recámaras, hasta 28 mil al mes. ¿Tienes algo?" },
  ],
  max_tokens: 900,
  temperature: 0.5,
  response_format: { type: "json_object" },
};

const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: "Bearer " + T, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const j = await r.json().catch(() => ({}));
console.log("status:", r.status, "finish:", j?.choices?.[0]?.finish_reason);
console.log("usage:", JSON.stringify(j?.usage?.completion_tokens_details));
const content = j?.choices?.[0]?.message?.content;
console.log("\n=== JSON CRUDO DEL MODELO ===");
console.log(content);
