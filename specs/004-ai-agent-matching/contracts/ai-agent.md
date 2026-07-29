# Contrato — Agente de IA + matching (004)

**Feature**: `004-ai-agent-matching` · **Date**: 2026-06-19

Define las interfaces internas (motor de matching, loop del agente, salida del modelo) y los
endpoints HTTP que expone la feature.

---

## 1. Adaptador de IA — `src/lib/ai/openrouter.ts`

```ts
// Llamada de chat genérica (texto).
chat(opts: { model: string; system: string; messages: ChatMsg[]; maxTokens?: number;
             temperature?: number; timeoutMs?: number }): Promise<string>

// Igual pero forzando salida JSON validada con un schema Zod.
chatJson<T>(opts: { ...; schema: ZodSchema<T> }): Promise<T>
```

- Endpoint: `${OPENROUTER_BASE_URL}/chat/completions`, header `Authorization: Bearer
  ${OPENROUTER_API_TOKEN}`. Nunca loggea la clave ni el contenido completo (Principio I).
- Modelos por env: `OPENROUTER_AGENT_MODEL` (default `deepseek/deepseek-v4-flash`),
  `OPENROUTER_MATCH_MODEL` (default `deepseek/deepseek-v4-pro`).
- Errores → lanza `AiError`; el llamador degrada con gracia (FR-019).

## 2. Motor de matching — `src/server/matching/engine.ts`

```ts
computeMatches(organizationId: string, req: ClientRequirements,
               opts?: { topN?: number; explain?: boolean }): Promise<Match[]>
```

- **Etapa 1 (determinista)**: `property` del tenant con `status='disponible'`; gate por `operation`;
  score ponderado (presupuesto dentro de rango/±15%, zona, tipo, recámaras, baños) → `pct` base +
  `reasons` (cumple/no cumple por criterio). Ordena, toma `topN` (default 5).
- **Etapa 2 (IA, `explain` true)**: pasa el top-N + requisitos a `OPENROUTER_MATCH_MODEL`; recibe
  JSON `{ ranking: [{ propertyId, pct, why }] }` (Zod). Reordena/ajusta `pct` y rellena `why`.
- **Caché** por `(conversationId|clientId, requirements.version)`: no recomputa la etapa IA en cada
  poll del panel; se invalida al subir `version`.
- **Aislamiento**: solo propiedades de `organizationId` (FR-003/017). **Sin coincidencias** →
  devuelve `[]` (la UI lo comunica; nunca inventa).

## 3. Loop del agente — `src/server/ai/agent.ts`

```ts
runAgentForInboundMessage(args: { organizationId: string; conversationId: string;
                                  inboundMessageId: string }): Promise<void>
```

Flujo (se ejecuta vía `after()` tras el webhook, solo si insert nuevo + `aiEnabled` + texto +
`!needsHuman`):
1. Carga conversación, cliente, `client_requirements`, historial reciente (~15 msgs) y
   `computeMatches(..., { explain: true })` (top matches reales del tenant).
2. Llama `OPENROUTER_AGENT_MODEL` con el system prompt (§4) + historial + requisitos + matches, y
   pide el **JSON de salida** (§5), validado con Zod.
3. Ejecuta efectos **en el servidor** (el modelo no toca BD):
   - `requirements` → merge/upsert (`server/requirements/service.ts`); sube `version`.
   - `action.send_sheet{propertyId}` → valida que el `propertyId` está entre los matches del tenant;
     envía la ficha por WhatsApp (mensaje `kind:"property"`, `aiGenerated:true`).
   - `action.schedule_visit{propertyId, whenISO}` → crea `showing` (cliente, propiedad, fecha,
     asesor asignado) — US4.
   - `action.handoff{reason}` → `conversation.needsHuman=true`; **no** responde más.
4. Envía `reply` por WhatsApp (texto, `aiGenerated:true`) si no hubo handoff, respetando la ventana
   24 h (dentro: texto; si por alguna razón está fuera: plantilla o avisa, FR-015).
5. Cualquier fallo de IA → no envía, registra (sin secretos), deja la conversación a humano (FR-019).

**Idempotencia**: el disparo solo ocurre cuando el insert del entrante fue nuevo (UNIQUE
`wa_message_id`); un reintento del webhook no relanza el agente (FR-009/SC-005).

## 4. System prompt del asesor — `src/server/ai/prompts.ts`

Reglas no negociables incluidas en el prompt:
- Eres el asistente de la agencia inmobiliaria {nombre}. Español de México, tono **amable,
  profesional y efectivo**; mensajes breves para WhatsApp.
- **Solo** puedes hablar de las propiedades del inventario provisto; **NO inventes** propiedades,
  precios ni datos. Si falta info, pídela con naturalidad.
- **No** redactes ni firmes contratos ni hagas promesas vinculantes (solo informas/calificas/
  agendas).
- Califica al cliente: deduce operación, presupuesto, zona, tipo, recámaras, baños de lo que dice.
- Ofrece la propiedad de mayor afinidad cuando tenga sentido; agenda visita si hay interés.
- Haz **handoff** si: pide hablar con una persona, intención de cierre/negociación, tema sensible o
  fuera de lo inmobiliario.

## 5. JSON de salida del agente (validado con Zod)

```json
{
  "reply": "texto a enviar al cliente (es-MX, breve)",
  "requirements": {
    "operation": "renta|venta|null",
    "budgetMin": 0, "budgetMax": 0,
    "zone": "string|null", "propertyType": "casa|departamento|local|terreno|null",
    "bedrooms": 0, "bathrooms": 0, "notes": "string|null"
  },
  "action": { "type": "none|send_sheet|schedule_visit|handoff",
              "propertyId": "string?", "whenISO": "string?", "reason": "string?" }
}
```
Campos de `requirements` opcionales (solo lo que se infirió este turno). `propertyId` debe existir en
los matches del tenant o la acción se ignora (anti-alucinación).

## 6. Endpoints HTTP

### `POST /api/conversations/{id}/agent`  *(asesor del tenant)*
Body: `{ "enabled": boolean }` o `{ "resume": true }` (reanudar tras handoff →
`needsHuman=false`). Efecto: cambia `aiEnabled`/`needsHuman` de la conversación (con scope de
tenant). 200 `{ aiEnabled, needsHuman }`.

### `GET /api/conversations/{id}/requirements`  ·  `PUT …/requirements`  *(asesor)*
GET → requisitos actuales del cliente. PUT body = campos de requisitos → upsert `source:"manual"`,
sube `version`, invalida caché de matches. 200 con los requisitos resultantes.

### (Lectura) matching en la carga de la conversación
`server/inbox/queries.ts` surte, por conversación: `requirements`, `matches` (reales),
`aiEnabled`, `needsHuman` — consumidos por la bandeja (mismo contrato visual de 003).

## 7. Reglas verificables (resumen)

- Solo texto del tenant entra al prompt; matches solo del tenant (FR-003/017).
- Una respuesta por entrante (FR-009). Agente off → 0 respuestas (FR-005/SC-007).
- 0 propiedades/precios inventados; `propertyId` de acciones validado contra matches (FR-008/SC-004).
- Handoff al pedir asesor/cierre/sensible (FR-013/SC-006).
- Fallo de IA → nada enviado, conversación a humano (FR-019).
- Sin contratos ni promesas vinculantes (FR-016).
