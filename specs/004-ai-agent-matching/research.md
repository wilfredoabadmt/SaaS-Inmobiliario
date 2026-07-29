# Research — Agente de IA conversacional + matching (004)

**Feature**: `004-ai-agent-matching` · **Date**: 2026-06-19

Resuelve las decisiones técnicas previas a la Fase 1. Proveedor de IA: **OpenRouter**; modelos
decididos por el dueño: agente `deepseek/deepseek-v4-flash`, matching `deepseek/deepseek-v4-pro`.

---

## D1 — Integración de IA aislada tras un adaptador (`lib/ai`)

**Decisión**: Toda llamada a la IA pasa por un adaptador único `src/lib/ai/openrouter.ts`
(cliente de Chat Completions de OpenRouter, compatible con el formato OpenAI). El resto del
código (agente, matching) consume funciones tipadas (`chat()`, `chatJson<T>()`) sin acoplarse al
proveedor. Config por entorno: `OPENROUTER_API_TOKEN` (ya en `.env`), `OPENROUTER_AGENT_MODEL`
(default `deepseek/deepseek-v4-flash`), `OPENROUTER_MATCH_MODEL` (default
`deepseek/deepseek-v4-pro`), `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`).

**Rationale**: Principio II — las integraciones externas inevitables se aíslan tras una frontera
clara (igual que WhatsApp en `lib/meta`). La IA no es función *core* (auth/DB siguen self-hosted);
es un servicio externo detrás de un adaptador, portable a otro proveedor/clave per-tenant después.

**Alternativas**: SDK de un proveedor concreto (acopla); llamar fetch disperso por el dominio
(rompe el aislamiento).

---

## D2 — Matching: filtro duro determinista + ranking/explicación con IA (v4-pro)

**Decisión**: Dos etapas.
1. **Filtro + score determinista** (rápido, barato, sin IA): de `property` del tenant con
   `status='disponible'`, filtra por **operación** (dura) y descarta lo claramente fuera; calcula
   un **% base** ponderando criterios: operación (gate), presupuesto (dentro del rango → alto;
   tolerancia ±15% → parcial), zona (coincide colonia/ciudad), tipo, recámaras, baños. Produce
   `reasons` (cumple/no cumple por criterio) y un % inicial. Ordena y toma el **top-N** (p. ej. 5).
2. **Ranking + explicación con IA** (`deepseek/deepseek-v4-pro`): al top-N le pide una valoración
   final (ajuste de orden ante tradeoffs) y una **explicación breve** por propiedad, en JSON
   estructurado. El resultado se **cachea por (conversación, versión de requisitos)** para no
   recomputar en cada poll del panel.

**Rationale**: El filtro duro garantiza que nunca se ofrezca algo fuera de operación/presupuesto y
da determinismo (evita alucinaciones de % y respeta FR-008/SC-004). La IA aporta el matiz de
tradeoffs y la explicación natural que pide el diferenciador, sobre un conjunto pequeño (barato).
Cachear por versión de requisitos controla coste/latencia (la live panel hace polling).

**Alternativas**: solo-IA sobre todo el inventario (caro, no determinista, riesgo de inventar);
solo-determinista (sin la explicación/insight que vende el producto). DV elegido: híbrido.

---

## D3 — El agente como una sola llamada con salida estructurada (tool-use ligero)

**Decisión**: Por cada mensaje entrante a procesar, el agente arma **un** prompt para
`deepseek/deepseek-v4-flash` con: (a) system prompt (asesor inmobiliario de la agencia, español MX,
tono amable/efectivo, **no inventar**, **no contratos**, cuándo hacer handoff), (b) historial
reciente de la conversación, (c) requisitos actuales del cliente, (d) el **top de matches**
(inventario real ya filtrado), y pide una **respuesta JSON** con: `reply` (texto a enviar),
`requirements` (campos extraídos/actualizados), `action` (`none | send_sheet{propertyId} |
schedule_visit{propertyId,when} | handoff{reason}`). El servidor valida el JSON (Zod), aplica los
efectos (guardar requisitos, enviar ficha, crear visita, marcar handoff) y envía `reply` por
WhatsApp.

**Rationale**: Un solo turno con salida estructurada es simple, barato y determinista de orquestar;
evita un framework de agentes. El servidor —no el modelo— ejecuta las acciones, así el modelo
nunca toca datos directamente (seguridad/aislamiento). El inventario en el prompt ya viene
filtrado por tenant, así que el modelo no puede ofrecer algo inexistente.

**Alternativas**: framework multi-tool con varias llamadas (más caro/lento, innecesario en MVP);
function-calling nativo (válido, pero JSON estructurado es suficiente y portable).

---

## D4 — Punto de enganche: tras el insert idempotente del entrante, vía `after()`

**Decisión**: En `processWebhookValue` (ingest), al insertar un mensaje entrante se usa
`returning` para saber si **fue nuevo** (no un reintento). Si fue nuevo **y** la conversación tiene
el agente **activo** (`ai_enabled`) **y** no está en handoff (`needs_human=false`) **y** el mensaje
es **texto**, se encola el procesamiento del agente. La ejecución del agente corre **después** de
responder 200 al webhook usando `after()` de `next/server` (Meta exige ack rápido; el agente puede
tardar segundos). El gate "insert nuevo" + el UNIQUE de `wa_message_id` garantizan **una sola**
respuesta por mensaje (FR-009/SC-005).

**Rationale**: Meta reintenta si el webhook tarda; `after()` corre la tarea post-respuesta en el
proceso `next start` (Coolify es long-running, no serverless efímero). La idempotencia se apoya en
el mismo UNIQUE que ya protege el inbound.

**Alternativas**: procesar inline antes del 200 (riesgo de timeout/reintentos de Meta); una cola
externa (sobre-ingeniería para MVP en un contenedor).

---

## D5 — Modelo de datos: tabla nueva + columnas en existentes

**Decisión**:
- **`client_requirements`** (tabla nueva, 1:1 por cliente, upsert): `organizationId`, `clientId`
  (unique por org), `operation`, `budgetMin`, `budgetMax`, `zone`, `propertyType`, `bedrooms`,
  `bathrooms`, `notes`, `source` (`ai`|`manual`), `updatedAt`. Indexada por org/cliente.
- **`conversation`**: + `ai_enabled` boolean default false (opt-in), + `needs_human` boolean
  default false (handoff).
- **`message`**: + `ai_generated` boolean default false (distingue agente vs humano).

**Rationale**: Los requisitos son la entidad que faltaba para encender el matching; van por cliente
(DV-4: cliente 1:N conversaciones). Las flags en `conversation`/`message` son mínimas y evitan
tablas extra. Migración Drizzle aditiva (no rompe datos existentes).

**Alternativas**: requisitos embebidos en `client.notes` (no consultable/estructurado); tabla
`conversation_agent_state` aparte (innecesaria; 2 columnas bastan).

---

## D6 — Handoff: decisión del modelo + heurística de respaldo

**Decisión**: El handoff es una **acción** que el modelo puede elegir (`action: handoff`), guiado
por el system prompt (cierre/negociación, "quiero un asesor", tema sensible/fuera de dominio).
Además, una **heurística** server-side detecta frases explícitas ("hablar con una persona/asesor",
"agente humano") y fuerza handoff aunque el modelo no lo marque. Al hacer handoff se pone
`needs_human=true` y el agente deja de auto-responder hasta que el asesor lo reactive.

**Rationale**: La IA capta matices; la heurística garantiza el caso explícito (SC-006 = 100%).

---

## D7 — Degradación ante fallo de IA

**Decisión**: Si OpenRouter falla/timeout, el agente **no** envía nada, registra el fallo
server-side (sin secretos) y deja la conversación para atención humana (no marca respuesta
enviada). La bandeja sigue 100% usable a mano. Timeout prudente (p. ej. 30 s) y sin reintentos
agresivos.

**Rationale**: FR-019; nunca reportar como hecho algo que no salió (Principio V).

---

## D8 — Extracción de requisitos y presupuesto

**Decisión**: El modelo extrae los requisitos de la conversación y los devuelve en el JSON; el
servidor hace **merge** (no borra lo previo si el turno no lo menciona). El **presupuesto** se
guarda como rango (`budgetMin`/`budgetMax`); si el cliente da un solo número se interpreta como
objetivo con tolerancia ±15% en el scoring (no corte binario), salvo que diga "máximo".

**Rationale**: FR-007; coincide con el Assumptions del spec (presupuesto blando).

---

## D9 — Auto-test (paso post-implement de la metodología)

**Decisión**: Se extiende `scripts/wa-tester/` con un guion que: (1) siembra propiedades de prueba
(fixtures) como inventario del tenant de prueba; (2) activa el agente en la conversación; (3) vía
Evolution, **se hace pasar por cliente** mandando mensajes desde el número personal al número de
prueba ("busco depto renta en Polanco, 2 rec, hasta 28 mil"); (4) lee la respuesta del agente
(por Evolution / la bandeja) y **verifica**: requisitos capturados, propiedad propuesta = la de
mayor afinidad real, tono amable, ficha correcta, handoff cuando se pide asesor. Cierra el sprint
cuando SC-001…SC-006 se corroboran. Allowlist del guardrail ya incluye el número de prueba.

**Rationale**: Implementa el paso de self-test que el dueño añadió a la metodología
([[feedback-self-test-after-implement]]). El dueño escribe specs; yo verifico el comportamiento.

---

## D10 — Coste y latencia

**Decisión**: Historial acotado (últimos ~15 mensajes), inventario en prompt acotado al top-N del
filtro duro, `max_tokens` moderado, y caché de matches por versión de requisitos. Modelos baratos
elegidos (flash $0.09/$0.18; pro $0.43/$0.87 por 1M). Sin streaming en MVP (respuesta completa →
un solo mensaje de WhatsApp).

**Rationale**: Mantiene el coste por conversación bajo y la latencia razonable para WhatsApp.

---

## Resumen

| # | Decisión |
|---|----------|
| D1 | Adaptador `lib/ai/openrouter` + config por env (token + modelos) |
| D2 | Matching híbrido: filtro/score determinista + ranking/explicación IA (v4-pro), cacheado |
| D3 | Agente = 1 llamada (v4-flash) con salida JSON (reply + requirements + action); el server ejecuta |
| D4 | Enganche en ingest tras insert nuevo, vía `after()`; idempotente |
| D5 | `client_requirements` nuevo + `conversation.ai_enabled/needs_human` + `message.ai_generated` |
| D6 | Handoff por acción del modelo + heurística explícita |
| D7 | Degradación con gracia ante fallo de IA |
| D8 | Requisitos por merge; presupuesto blando ±15% |
| D9 | Auto-test por WhatsApp (Evolution) como cierre del sprint |
| D10 | Controles de coste/latencia |
