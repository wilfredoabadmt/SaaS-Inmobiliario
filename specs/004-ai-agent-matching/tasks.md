---
description: "Task list — Agente de IA conversacional + matching (004)"
---

# Tasks: Agente de IA conversacional + matching propiedad↔cliente

**Input**: Design documents from `specs/004-ai-agent-matching/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ai-agent.md, quickstart.md

**Tests**: No se generan tests unitarios automatizados (no solicitados). La verificación es
typecheck + lint + build **+ self-test de comportamiento** (paso de metodología): conversar como
cliente por WhatsApp y corroborar SC-001…SC-006 (Phase 9).

**Organization**: Tareas agrupadas por historia (US1–US5) en orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: A qué historia pertenece (US1–US5)

## Path Conventions

Web app monolítica Next.js (App Router), single project: `src/app/`, `src/components/`, `src/lib/`,
`src/server/`. IA aislada en `src/lib/ai`. Contrato técnico: `contracts/ai-agent.md`.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Añadir variables de entorno de IA a `src/lib/env.ts`: `OPENROUTER_API_TOKEN` (requerido), `OPENROUTER_AGENT_MODEL` (default `deepseek/deepseek-v4-flash`), `OPENROUTER_MATCH_MODEL` (default `deepseek/deepseek-v4-pro`), `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`); confirmar que `.env` local ya tiene `OPENROUTER_API_TOKEN`
- [x] T002 Confirmar que NO se requieren dependencias nuevas (se usa `fetch` nativo + Zod existente); documentar en el plan si algo cambia

**Checkpoint**: Config de IA lista por entorno.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [x] T003 Extender `src/lib/db/schema/domain.ts`: tabla **`client_requirements`** (id, organizationId, clientId UNIQUE por org, operation, budgetMin, budgetMax, zone, propertyType, bedrooms, bathrooms, notes, source `ai|manual`, version, updatedAt) + índices (data-model.md)
- [x] T004 Extender `src/lib/db/schema/domain.ts`: columnas `conversation.ai_enabled` (bool default false), `conversation.needs_human` (bool default false), `message.ai_generated` (bool default false)
- [x] T005 Generar la migración Drizzle aditiva (`pnpm db:generate`) y revisar el SQL en `drizzle/` (no debe alterar datos existentes)
- [x] T006 [P] Crear el adaptador de IA `src/lib/ai/openrouter.ts`: `chat()` y `chatJson<T>(schema)` contra `${OPENROUTER_BASE_URL}/chat/completions` con `Authorization: Bearer`, timeout, clase `AiError`; NUNCA loguear la clave (Principio I)
- [x] T007 [P] Ampliar `src/lib/inbox/types.ts`: tipos reales de `ClientRequirements`, `Match` (ya existe), y `ConversationAgentState` (aiEnabled, needsHuman); añadir `aiGenerated?` a `MessageItem`
- [x] T008 Añadir prefijo de id para `clientRequirements` en `src/lib/db/ids.ts` (newId)
- [x] T009 Verificar typecheck en verde tras el esquema/adaptador (`pnpm typecheck`)

**Checkpoint**: Esquema + adaptador de IA listos; las historias pueden construirse.

---

## Phase 3: User Story 1 — Requisitos del cliente + matching real con IA (Priority: P1) 🎯 diferencial

**Goal**: Capturar requisitos y mostrar el ranking real propiedad↔cliente en el panel (reemplaza fixtures).

**Independent Test**: Capturar requisitos (PUT) y ver el panel con propiedades reales rankeadas por
afinidad; cambiar un requisito cambia el ranking; "sin requisitos"/"sin coincidencias" se comunican.

- [x] T010 [US1] Crear `src/server/requirements/service.ts`: `getRequirements(orgId, clientId)`, `upsertRequirements(orgId, clientId, patch, source)` con **merge** (no borra campos no mencionados) e incremento de `version` solo si cambió algo (D8)
- [x] T011 [US1] Crear `src/server/matching/engine.ts` — etapa determinista: filtra `property` del tenant (`status='disponible'`, gate por operación), score ponderado (presupuesto ±15%, zona, tipo, recámaras, baños) → `pct` base + `reasons`; ordena y toma top-N (default 5); aislamiento de tenant (FR-003/017)
- [x] T012 [US1] Añadir a `src/server/matching/engine.ts` la etapa IA: `OPENROUTER_MATCH_MODEL` rankea/explica el top-N (JSON validado con Zod → `{ranking:[{propertyId,pct,why}]}`); fusiona con la etapa 1; **caché** por `(clientId, requirements.version)`; sin coincidencias → `[]`
- [x] T013 [US1] Modificar `src/server/inbox/queries.ts`: por conversación, surtir `requirements`, `matches` reales (computeMatches), `aiEnabled`, `needsHuman` (reemplaza datos de muestra)
- [x] T014 [US1] Crear `src/app/api/conversations/[id]/requirements/route.ts`: `GET` (requisitos actuales) y `PUT` (upsert `source:"manual"`, sube version, invalida caché) — scope de tenant (requireMember)
- [x] T015 [US1] Modificar `src/app/(dashboard)/inbox/page.tsx` para pasar `requirements`/`matches`/estado del agente reales al `InboxClient` (en lugar del fixture)
- [x] T016 [US1] Ajustar `src/components/inbox/matching-panel.tsx` e `inbox-client.tsx` para consumir matches reales con el **mismo contrato visual** de 003 (estado "sin requisitos" y "sin coincidencias" claros)

**Checkpoint**: El panel "Matching en vivo" muestra el cruce real (SC-001 verificable de forma manual).

---

## Phase 4: User Story 2 — El agente responde y califica (híbrido, opt-in) (Priority: P1) 🎯 núcleo

**Goal**: Activar el agente por conversación; responde en es-MX y extrae los requisitos del cliente.

**Independent Test**: Activar el agente, escribir como cliente y ver respuesta con sentido + requisitos
capturados; con el agente apagado, 0 respuestas automáticas.

- [x] T017 [US2] Crear `src/server/ai/prompts.ts`: system prompt del asesor (es-MX, amable/efectivo, **no inventar**, **no contratos**, reglas de calificación y de handoff) según contrato §4
- [x] T018 [US2] Crear `src/server/ai/agent.ts` `runAgentForInboundMessage(...)`: carga contexto (conversación, cliente, requisitos, historial ~15, matches reales), llama `OPENROUTER_AGENT_MODEL`, valida el **JSON de salida** (Zod, contrato §5); aplica `requirements` (merge vía service) y envía `reply` por WhatsApp como `aiGenerated:true`
- [x] T019 [US2] Añadir helper de envío saliente reutilizable (texto y ficha) para el agente — extraer de la ruta de mensajes o crear `src/server/inbox/send.ts` (usa `lib/meta` con normalización MX) y persiste el mensaje con `aiGenerated`
- [x] T020 [US2] Modificar `src/server/inbox/ingest.ts`: tras insert **nuevo** de entrante (returning), si `aiEnabled && !needsHuman && body es texto`, disparar `runAgentForInboundMessage` vía `after()` de `next/server` (idempotente, D4)
- [x] T021 [US2] Crear `src/app/api/conversations/[id]/agent/route.ts`: `POST { enabled }` (activar/desactivar) y `{ resume:true }` (reanudar handoff → needs_human=false); scope de tenant
- [x] T022 [US2] Modificar `src/components/inbox/chat-thread.tsx`: toggle del agente en la cabecera; distinguir visualmente los mensajes `aiGenerated` (etiqueta "IA") del asesor
- [x] T023 [US2] Degradación: si la IA falla/timeout en `agent.ts`, no enviar nada, loguear sin secretos, dejar la conversación a humano (FR-019)

**Checkpoint**: El agente atiende y califica en conversaciones activadas; respeta opt-in e idempotencia.

---

## Phase 5: User Story 3 — El agente envía la mejor ficha (Priority: P2)

**Goal**: El agente manda por WhatsApp la ficha de la propiedad de mayor afinidad cuando aplica.

**Independent Test**: Tras calificar, el agente envía la ficha del mejor match; sin match suficiente, no envía ficha irrelevante.

- [x] T024 [US3] En `src/server/ai/agent.ts`, manejar `action.send_sheet{propertyId}`: validar que `propertyId` está entre los matches reales del tenant (anti-alucinación), enviar la ficha (`kind:"property"`, `aiGenerated:true`) y registrarla como último mensaje
- [x] T025 [US3] Asegurar que la ficha enviada por el agente se renderiza en el hilo (reusa la burbuja de propiedad de 003) y actualiza `lastMessageAt`

**Checkpoint**: El agente entrega valor (ficha correcta) sin intervención humana.

---

## Phase 6: User Story 4 — El agente propone y agenda visita (Priority: P2)

**Goal**: Al acordar fecha/hora, el agente registra una visita visible en Visitas.

**Independent Test**: Conversar pidiendo ver una propiedad y verificar que se crea un `showing` (cliente, propiedad, fecha, asesor).

- [x] T026 [US4] Crear `src/server/showings/service.ts` `createShowingFromAgent(orgId, conversationId, propertyId, whenISO)`: resuelve cliente/asesor asignado, inserta `showing` (status agendada, remindAt) — scope de tenant
- [x] T027 [US4] En `src/server/ai/agent.ts`, manejar `action.schedule_visit{propertyId, whenISO}`: validar propertyId del tenant y crear la visita; confirmar en `reply`
- [x] T028 [US4] Verificar que la visita creada aparece en la vista de Visitas (`/showings`) — conectar la vista a datos reales si aún usa fixtures (mínimo para mostrar la visita del agente)

**Checkpoint**: De interés → visita agendada por el agente.

---

## Phase 7: User Story 5 — Handoff a un humano (Priority: P2)

**Goal**: El agente cede a un humano en cierre/sensible/"quiero asesor" y la bandeja lo señala.

**Independent Test**: Pedir "quiero hablar con un asesor" → el agente deja de responder y la conversación se marca "requiere atención humana".

- [x] T029 [US5] En `src/server/ai/agent.ts`, manejar `action.handoff{reason}` + **heurística** server-side de frases explícitas ("hablar con una persona/asesor/humano") que fuerza handoff aunque el modelo no lo marque (D6); set `needs_human=true` y no responder más
- [x] T030 [US5] Señal de handoff en la bandeja: badge "requiere atención humana" en la lista (`inbox-client.tsx`) y en la cabecera (`chat-thread.tsx`); botón "reanudar agente" (usa `/agent { resume:true }`)
- [x] T031 [US5] Asegurar que en handoff los mensajes del asesor salen como humano (no `aiGenerated`) y el agente no interfiere hasta reanudar

**Checkpoint**: Modo híbrido completo: IA atiende, humano cierra.

---

## Phase 8: Polish & Cross-Cutting

- [x] T032 [P] Auditoría anti-alucinación: el inventario al prompt solo del tenant; todo `propertyId` de acción validado contra matches; sin precios/propiedades inventados (FR-008/SC-004)
- [x] T033 [P] Verificar idempotencia: un reintento del webhook no relanza el agente (gate insert-nuevo + UNIQUE) — prueba con doble POST al webhook (SC-005)
- [x] T034 [P] Verificar ventana 24 h y "agente off = 0 respuestas" (FR-015/SC-007)
- [x] T035 Ejecutar la puerta de calidad: `pnpm typecheck && pnpm lint && pnpm build` en verde (SC-008 parte automática)

---

## Phase 9: Self-test de comportamiento (cierre del sprint) 🔴 obligatorio

**Goal**: Corroborar, conversando como cliente por WhatsApp, que el agente hace match efectivo,
responde amable/efectivo, califica bien y envía la ficha correcta (SC-001…SC-006). **El sprint no se
cierra sin esto** (metodología `feedback-self-test-after-implement`).

- [x] T036 Crear `scripts/wa-tester/seed-properties.mjs`: siembra propiedades de prueba (fixtures) como inventario del tenant de prueba (vía API/DB de prod o el seed existente)
- [x] T037 Crear `scripts/wa-tester/agent-roundtrip.mjs`: activa el agente en la conversación, y vía Evolution (personal → número de prueba) **conversa como cliente** (renta Polanco 2 rec ≤28k; pide estacionamiento; pide visita; pide asesor)
- [x] T038 En `agent-roundtrip.mjs`, **verificar** con asserts + IA: requisitos capturados (SC-002), propiedad propuesta = mejor match real (SC-001), tono amable/sin inventar (SC-003/004), ficha correcta (US3), handoff al pedir asesor (SC-006), idempotencia (SC-005)
- [x] T039 Desplegar a inmox-dev (rama 004) y correr el self-test contra el entorno real; iterar/autocorregir hasta que pase; dejar evidencia (transcripción/capturas)
- [x] T040 Recorrer `quickstart.md` (checklist de cierre) y declarar el sprint hecho solo con todo en verde

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** bloquea todo (esquema + adaptador IA + tipos).
- **US1 (3)**: requisitos + matching real. Base del diferencial y de las acciones del agente.
- **US2 (4)**: el agente. Depende de Foundational; usa el matching de US1 (matches reales en el prompt) y el envío saliente.
- **US3 (5)**, **US4 (6)**, **US5 (7)**: acciones/handoff del agente; dependen de US2 (y US1 para matches/ficha).
- **Polish (8)** y **Self-test (9)**: tras las historias deseadas; el Self-test cierra el sprint.

### User Story Dependencies

- US1 (P1) → independiente (matching + requisitos).
- US2 (P1) → depende de Foundational; **consume** US1 (matches reales).
- US3/US4/US5 (P2) → dependen de US2; US3 además de US1.

### Within Each Story

- Servicios/modelo antes que el loop del agente; el loop antes que las acciones; endpoints y UI tras la lógica.

### Parallel Opportunities

- T006 (adaptador IA), T007 (tipos), T008 (ids) en paralelo en Foundational.
- T010 (requirements) y T011 (matching etapa 1) en paralelo dentro de US1.
- T032–T034 (auditorías de Polish) en paralelo.

---

## Implementation Strategy

### MVP (P1: matching real + agente que responde y califica)

1. Setup + Foundational (esquema, adaptador IA, tipos).
2. US1 (requisitos + matching real) → US2 (agente responde + califica).
3. **Self-test parcial**: el agente califica y propone el mejor match.

### Incremental

4. US3 (ficha) → US4 (visita) → US5 (handoff).
5. Polish (auditorías + puerta de calidad).
6. **Phase 9 Self-test completo** → cierre del sprint con evidencia.

---

## Notes

- IA aislada en `src/lib/ai`; el **servidor** ejecuta las acciones (el modelo no toca BD).
- Idempotencia anclada al UNIQUE `message.wa_message_id` + gate insert-nuevo.
- Anti-alucinación: inventario filtrado por tenant en el prompt + validación de `propertyId`.
- "Hecho" = typecheck + lint + build **+ self-test** que corrobora SC-001…SC-006.
- El guardrail de Evolution (allowlist personal + número de prueba) y el anti-ráfaga aplican al self-test.
