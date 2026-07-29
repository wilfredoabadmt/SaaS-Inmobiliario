---
description: "Task list — Robustez y modo híbrido confiable del agente de IA (005)"
---

# Tasks: Robustez y modo híbrido confiable del agente de IA

**Input**: Design documents from `specs/005-robustez-agente/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/agent-robustness.md, quickstart.md

**Tests**: No se generan tests unitarios automatizados (no solicitados). La verificación es
typecheck + lint + build **+ self-test de comportamiento** (paso de metodología): simular/conversar
los 4 casos (fuera de 24 h, no-texto, ráfaga, fallo de IA) y corroborar SC-001…SC-007 (Phase 8).

**Organization**: Tareas agrupadas por historia (US1–US4) en orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: A qué historia pertenece (US1–US4)

## Path Conventions

Web app monolítica Next.js (App Router), single project: `src/app/`, `src/components/`, `src/lib/`,
`src/server/`. Robustez en el borde `src/server/{inbox,ai}`. Contrato: `contracts/agent-robustness.md`.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Añadir `AGENT_COALESCE_MS` a `src/lib/env.ts` (numérica, **opcional**, default `6000`) con coerción/validación Zod, siguiendo el patrón de envs opcionales existentes (degrada con default si falta)
- [x] T002 Confirmar que NO se requieren dependencias nuevas (se reusa `lib/ai`, `lib/meta`, Drizzle, Zod; el debounce/lock es módulo propio en memoria); documentar en el plan si algo cambia

**Checkpoint**: Config lista; sin libs nuevas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase (esquema + tipos + plumbing de la señal).

- [x] T003 Extender `src/lib/db/schema/domain.ts`: nuevo `pgEnum("needs_human_reason", ["requested","out_of_window","uninterpretable","ai_error"])` + columna `conversation.needs_human_reason` (enum, **nullable**); invariante: `null` cuando `needs_human=false` (data-model.md)
- [x] T004 Extender `src/lib/db/schema/domain.ts`: columna `message.wa_type` (text, **nullable**) para el tipo del mensaje entrante de WhatsApp (text/audio/image/video/document/location/sticker/contacts)
- [x] T005 Generar la migración Drizzle **aditiva** (`pnpm db:generate`) y revisar el SQL en `drizzle/`: debe ser solo `CREATE TYPE` + `ALTER TABLE ... ADD COLUMN` ×2 (sin `DROP`/`UPDATE` de datos)
- [x] T006 [P] Ampliar `src/lib/inbox/types.ts`: `needsHumanReason?` en `ConversationListItem` (union de los 4 valores + null) y `waType?: string | null` en `MessageItem`
- [x] T007 [P] Modificar `src/server/inbox/queries.ts`: surtir `needsHumanReason` por conversación y el `waType` del último mensaje entrante a los DTOs de la bandeja (scope de tenant)
- [x] T008 Modificar `src/app/api/conversations/[id]/agent/route.ts`: al reanudar (`{ resume:true }`) limpiar `needs_human=false` **y** `needs_human_reason=null` (SC-007); preservar scope de tenant (requireMember)
- [x] T009 Verificar typecheck en verde tras esquema/tipos/queries (`pnpm typecheck`)

**Checkpoint**: La BD distingue el motivo y el tipo de mensaje; la bandeja puede leerlos; reanudar limpia ambos.

---

## Phase 3: User Story 1 — No fallar fuera de la ventana de 24 h (Priority: P1) 🎯

**Goal**: Antes de enviar texto libre, verificar la ventana 24 h; fuera → no enviar y ceder a humano con señal.

**Independent Test**: En una conversación cuyo último entrante tiene > 24 h, llega un mensaje nuevo → el agente no envía texto; `needs_human=true`, `needs_human_reason='out_of_window'`; 0 salientes nuevos.

- [x] T010 [US1] Añadir a `src/server/inbox/send.ts` (o helper en `src/server/ai/agent.ts`) un cálculo **server-side** de ventana 24 h: `isWindowOpen(lastInboundWaTimestamp)` = `Date.now() - ts < 24h` (replica `windowOpen` de `chat-thread.tsx`)
- [x] T011 [US1] En `src/server/ai/agent.ts`, antes de cualquier envío de texto libre: si la ventana está **cerrada**, no enviar nada, set `needs_human=true` + `needs_human_reason='out_of_window'` y `return` (sin registrar mensaje saliente) — RB-1/FR-001/FR-002/FR-003
- [x] T012 [US1] Señal en la bandeja con **etiqueta por motivo** (genérica, renderiza los 4 reasons) en `src/components/inbox/inbox-client.tsx` (lista) y `src/components/inbox/chat-thread.tsx` (cabecera): "Pidió un asesor" / "Fuera de ventana 24 h" / "Mensaje no interpretable" / "La IA no pudo responder" (reusada por US2 y US4)

**Checkpoint**: Fuera de ventana el agente nunca manda texto a ciegas; la conversación queda señalada y reanudable.

---

## Phase 4: User Story 2 — Atender los mensajes no textuales (Priority: P1)

**Goal**: Un audio/imagen/ubicación no deja al agente mudo: pide texto + señal; escala si insiste.

**Independent Test**: Con el agente activo, llega un audio → respuesta determinista pidiendo texto + `wa_type` persistido + visible en bandeja; un segundo no-texto seguido → handoff `uninterpretable`.

- [x] T013 [US2] Modificar `src/server/inbox/ingest.ts`: persistir `message.wa_type` desde `msg.type` del webhook para **todo** entrante (texto y no-texto); el path de texto sigue guardando `body`
- [x] T014 [US2] Añadir a `src/server/inbox/send.ts` un helper de **respuesta determinista** (texto fijo es-MX, sin LLM) que pide al cliente escribir por texto; envía como `aiGenerated=true` respetando la ventana 24 h (reusa el helper de T010; fuera de ventana aplica RB-1)
- [x] T015 [US2] En `src/server/inbox/ingest.ts`, con agente activo y `wa_type !== "text"`: enviar la respuesta determinista (T014) dentro de ventana; **mantener activo**; escalar a `needs_human=true` + `needs_human_reason='uninterpretable'` si el entrante **inmediatamente anterior** también fue no-texto (insiste) o si pide humano (`asksForHuman`) — RB-2/FR-004/FR-006/FR-007
- [x] T016 [US2] Renderizar el último entrante no-texto en `src/components/inbox/chat-thread.tsx` (burbuja, p. ej. "🎤 nota de voz", "🖼️ imagen") y en la preview de lista de `inbox-client.tsx` usando `waType` — satisface FR-005 (no queda invisible)

**Checkpoint**: Ningún no-texto cae en el vacío; el cliente recibe respuesta y la bandeja lo muestra.

---

## Phase 5: User Story 3 — Una sola respuesta coherente ante ráfaga (Priority: P2)

**Goal**: Coalescer mensajes consecutivos por conversación en una sola corrida del agente.

**Independent Test**: 3 mensajes en < `AGENT_COALESCE_MS` → una respuesta coherente que considera los 3; requisitos consistentes; reenviar uno (mismo `wa_message_id`) → 0 efectos nuevos.

- [x] T017 [US3] Crear `src/server/ai/coalesce.ts`: estado **en memoria** por `conversationId` — `scheduleAgentRun(orgId, convId)` con **debounce** (`AGENT_COALESCE_MS`, reinicia el timer en cada entrante) + **lock** por conversación; al terminar, si quedó pendiente, reprograma una única corrida de seguimiento (contrato §2)
- [x] T018 [US3] Modificar `src/server/inbox/ingest.ts`: en el path de **texto** nuevo con agente activo, llamar `scheduleAgentRun(...)` (de T017) **en vez** de `runAgentForInboundMessage` directo, dentro del mismo `after()` (el agente relee el historial de la BD al disparar)
- [x] T019 [US3] Verificar que la coalescencia **preserva la idempotencia**: el gate insert-nuevo + UNIQUE `wa_message_id` no cambia; conversaciones distintas no se bloquean entre sí (lock por `convId`) — FR-009/FR-010/FR-011/SC-005

**Checkpoint**: Una ráfaga produce una respuesta coherente, sin solapamientos ni carreras, idempotente.

---

## Phase 6: User Story 4 — Degradación visible ante fallo de IA (Priority: P2)

**Goal**: Cuando el proveedor de IA falla, la conversación se señala (no queda muda en silencio).

**Independent Test**: Forzar fallo/timeout de IA con el agente activo → `needs_human=true` + `needs_human_reason='ai_error'`; 0 salientes; bandeja del resto operativa; sin secretos en logs.

- [x] T020 [US4] Modificar el `catch` de `runAgentForInboundMessage` en `src/server/ai/agent.ts`: además del `console.error` **sin secretos** (ya existe), set `needs_human=true` + `needs_human_reason='ai_error'` para la conversación; **no** enviar ni registrar respuesta — RB-4/FR-012/FR-013/FR-014
- [x] T021 [US4] Verificar que el fallo NO rompe la bandeja (resto de conversaciones operativas) y que la señal "La IA no pudo responder" aparece (reusa el badge de T012) — FR-013/SC-004

**Checkpoint**: El último modo de fallo silencioso queda cubierto: el fallo de IA es visible y accionable.

---

## Phase 7: Polish & Cross-Cutting

- [x] T022 [P] Auditoría de secretos: ningún log de los nuevos paths (ventana, no-texto, ráfaga, fallo) expone la clave de IA ni datos de otro tenant (FR-014/SC-006)
- [x] T023 [P] Auditoría de aislamiento: toda lectura/escritura nueva (`needs_human_reason`, `wa_type`, coalescencia) lleva scope de tenant (FR-011/FR-017)
- [x] T024 Verificar **agente desactivado = 0 comportamientos nuevos** (FR-016): con `conversation.ai_enabled=false`, ningún entrante (texto, no-texto, fuera de ventana, ráfaga) dispara respuesta del agente, coalescencia ni marca `needs_human_reason`; y **FR-007**: un mensaje de texto que llega tras un no-texto se procesa con normalidad (no queda bloqueado por el manejo de no-texto)
- [x] T025 Ejecutar la puerta de calidad: `pnpm typecheck && pnpm lint && pnpm build` en verde (SC-008 parte automática)

---

## Phase 8: Self-test de comportamiento (cierre del sprint) 🔴 obligatorio

**Goal**: Corroborar los 4 casos por comportamiento real (metodología `feedback-self-test-after-implement`). **El sprint no se cierra sin esto.** Reusa el guardrail de allowlist + anti-ráfaga de Evolution.

> **Estado (2026-06-20)**: código implementado y puerta de calidad en verde (T001–T025). Scaffold del
> self-test creado (T026). **T027–T032 pendientes de verificación humana / live**: requieren deploy a
> inmox-dev con la migración aplicada. Cobertura del tester en vivo: **solo el Caso B (no-texto) es
> reproducible de forma segura**. Caso A (fuera de 24 h) no se dispara por el flujo reactivo (un
> entrante nuevo reabre la ventana → es un guard defensivo, se verifica envejeciendo el timestamp en
> BD e invocando el agente). Caso C (ráfaga) choca con el guardrail anti-ráfaga (≥15 s) → verificar
> con test unitario de `coalesce.ts`. Caso D (fallo IA) requiere inyectar el fallo por env en el
> servidor. Ver cabecera de `scripts/wa-tester/agent-robustness.mjs`.

- [x] T026 Crear `scripts/wa-tester/agent-robustness.mjs`: andamiaje que activa el agente en la conversación de prueba y reutiliza el guardrail (allowlist personal/plataforma + anti-ráfaga)
- [ ] T027 [P] Caso A (fuera de 24 h): envejecer el `wa_timestamp` del último entrante a > 24 h en la BD de prueba y disparar un entrante; verificar 0 salientes del agente + `needs_human/out_of_window` (SC-001)
- [ ] T028 [P] Caso B (no-texto): enviar nota de voz/imagen vía Evolution; verificar respuesta determinista + `wa_type` persistido + señal en bandeja; segundo no-texto → handoff `uninterpretable` (SC-002)
- [ ] T029 [P] Caso C (ráfaga): enviar 3 mensajes en < `AGENT_COALESCE_MS`; verificar **una** respuesta coherente + requisitos consistentes + idempotencia al reenviar (SC-003/SC-005)
- [ ] T030 [P] Caso D (fallo IA): forzar fallo (clave inválida/modelo inexistente por env de prueba); verificar `needs_human/ai_error` + 0 salientes + bandeja operativa + sin clave en logs (SC-004/SC-006)
- [ ] T031 Desplegar a inmox-dev (rama 005), aplicar la migración aditiva y correr el self-test contra el entorno real; iterar/autocorregir hasta que pase; dejar evidencia (transcripción/capturas)
- [ ] T032 Recorrer `quickstart.md` (checklist de cierre, incl. reanudación que limpia motivo y no-regresión del camino feliz de 004) y declarar el sprint hecho solo con todo en verde

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** bloquea todo (esquema + tipos + plumbing de la señal + reanudar).
- **US1 (3)**: ventana 24 h. Aporta el helper de ventana (reusado por US2) y el badge por motivo (reusado por US2/US4).
- **US2 (4)**: no-texto. Depende de Foundational; usa el helper de ventana (US1·T010) y el badge (US1·T012).
- **US3 (5)**: ráfaga. Depende de Foundational; toca `ingest.ts` (coordinar con US2·T013/T015, mismo archivo).
- **US4 (6)**: fallo de IA. Depende de Foundational; reusa el badge (US1·T012).
- **Polish (7)** y **Self-test (8)**: tras las historias; el Self-test cierra el sprint.

### User Story Dependencies

- US1 (P1) → independiente (sobre Foundational); produce helpers compartidos.
- US2 (P1) → Foundational + helper de ventana (US1·T010) + badge (US1·T012).
- US3 (P2) → Foundational; independiente en lógica, comparte `ingest.ts` con US2.
- US4 (P2) → Foundational + badge (US1·T012).

### Within Each Story

- Esquema/tipos antes que la lógica; la lógica antes que la UI; el self-test al final.

### Parallel Opportunities

- T006 (types) y T007 (queries) en paralelo en Foundational (archivos distintos). **No** T003/T004 juntos (mismo `domain.ts`).
- T022 y T023 (auditorías de Polish) en paralelo.
- T027–T030 (casos del self-test) en paralelo en diseño, aunque comparten el script `agent-robustness.mjs` (T026) (coordinar al integrar).

---

## Implementation Strategy

### MVP (P1: nunca fallar en silencio en ventana 24 h + no-texto)

1. Setup + Foundational (esquema, tipos, plumbing de señal, reanudar).
2. US1 (ventana 24 h) → US2 (no-texto).
3. **Self-test parcial**: fuera de ventana y no-texto ya no quedan mudos.

### Incremental

4. US3 (ráfaga) → US4 (fallo de IA).
5. Polish (auditorías + puerta de calidad).
6. **Phase 8 Self-test completo** (los 4 casos) → cierre del sprint con evidencia.

---

## Notes

- Robustez en el borde `src/server/{inbox,ai}`; **no** se toca el contrato del webhook de Meta (firma/idempotencia) ni el matching de 004.
- Idempotencia anclada al UNIQUE `message.wa_message_id` + gate insert-nuevo; la coalescencia solo agrupa el *cuándo* se corre, no *qué* se inserta.
- El debounce/lock es **en memoria** (supuesto: instancia única en Coolify); escalar → lock compartido (BD/Redis).
- "Hecho" = typecheck + lint + build **+ self-test** que corrobora SC-001…SC-007; lo no verificable se marca pendiente de verificación humana.
- El soporte multimodal real (entender audio/imagen) y las fichas enriquecidas (imagen/carrusel) son **features aparte**, no entran en 005.
