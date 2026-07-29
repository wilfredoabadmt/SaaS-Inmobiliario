---
description: "Task list — Fichas de propiedad interactivas por WhatsApp (006)"
---

# Tasks: Fichas de propiedad interactivas por WhatsApp

**Input**: Design documents from `specs/006-fichas-interactivas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/fichas-interactivas.md, quickstart.md

**Tests**: No se generan tests unitarios automatizados (no solicitados). La verificación es
typecheck + lint + build **+ self-test de comportamiento**: enviar una ficha al número de prueba y
ver que llega como **una** tarjeta (foto + caption); tocar un botón y ver su acción (Phase 7).

**Organization**: Tareas agrupadas por historia (US1–US3) en orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: A qué historia pertenece (US1–US3)

## Path Conventions

Web app monolítica Next.js (App Router): `src/app/`, `src/components/`, `src/lib/`, `src/server/`.
Frontera Meta en `src/lib/meta`; dominio de la ficha en `src/server/inbox`. Contrato:
`contracts/fichas-interactivas.md`.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Confirmar que NO se requieren dependencias nuevas (se reusa `lib/meta`, `lib/storage` `getDownloadUrl`, Drizzle, Zod, el agendado de 004 y el handoff de 005); documentar en el plan si algo cambia

**Checkpoint**: Sin libs nuevas.

---

## Phase 2: Foundational (Blocking Prerequisites) — capacidad de tarjeta imagen+caption

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase (esquema + payload de imagen + envío de la tarjeta).

- [x] T002 Extender `src/lib/db/schema/domain.ts`: columna `message.property_id` (text, **nullable**, FK → `property.id` `ON DELETE set null`) para enlazar la ficha-tarjeta con su propiedad (data-model.md)
- [x] T003 Generar la migración Drizzle **aditiva** (`pnpm db:generate`) y revisar el SQL en `drizzle/`: solo `ALTER TABLE "message" ADD COLUMN "property_id"` (+ FK), sin `DROP`/`UPDATE`
- [x] T004 Añadir a `src/lib/meta/index.ts` `buildImagePayload(to, link, caption)` → payload `type:"image"` con `image:{link,caption}` (normaliza `to`) + tipo `SendImagePayload` (contrato §2)
- [x] T005 Crear `src/server/inbox/ficha.ts` `sendPropertyCard(orgId, conv, propertyId, { withButtons })`: valida propiedad del tenant; resuelve **foto principal** (`property_photo` menor `sortOrder`) → `getDownloadUrl(storageKey)`; arma caption con `formatPropertySheet`; verifica ventana 24 h (`isServiceWindowOpen`, 005); envía **imagen+caption** (T004) o **degrada a texto** si no hay foto; persiste el saliente con `property_id` y `body=caption` (contrato §1; FR-001/004/005/013)
- [x] T006 Verificar typecheck en verde tras esquema + payload + envío (`pnpm typecheck`)

**Checkpoint**: El sistema sabe enviar una propiedad como tarjeta imagen+caption (un mensaje) y degradar a texto.

---

## Phase 3: User Story 1 — El asesor envía la ficha como tarjeta y de verdad llega (Priority: P1) 🎯 MVP

**Goal**: Arreglar el botón "Enviar ficha" (hoy cosmético) para que entregue la tarjeta al cliente y se vea en el hilo.

**Independent Test**: Con una propiedad con foto, presionar "Enviar ficha" → el cliente recibe **un solo** mensaje con foto + texto, y la tarjeta aparece en el hilo; sin foto, llega ficha de texto.

- [x] T007 [US1] Crear `src/app/api/conversations/[id]/ficha/route.ts`: `POST { propertyId }` (Zod) con `requireMember` (scope de tenant) → `sendPropertyCard(...)`; respuestas `201 {id,status}`, `409` fuera de ventana ("usa plantilla"), `404` propiedad/conversación no del tenant, `422` inválido (contrato §5)
- [x] T008 [US1] Modificar `src/app/api/conversations/[id]/messages/route.ts` (GET): surtir `property_id`; cuando no es null, join a `property` + foto principal y armar `MessageItem.kind="property"` con su `PropertyView` para renderizar la **burbuja de ficha** (003) en el hilo
- [x] T009 [US1] Modificar `src/components/inbox/inbox-client.tsx`: `handleSendFicha` llama a `POST /api/conversations/[id]/ficha { propertyId }` (envío real) en vez de inyectar la burbuja local (`setInjected`); manejar error visible; dejar que el poll de tiempo real muestre el mensaje

**Checkpoint**: "Enviar ficha" entrega la tarjeta de verdad (SC-002) y se ve en la bandeja.

---

## Phase 4: User Story 2 — El agente envía la ficha como tarjeta (Priority: P1)

**Goal**: La acción "enviar la mejor ficha" del agente (004) sale como tarjeta con foto, no como texto.

**Independent Test**: Con el agente activo y un match con foto, el agente envía la ficha → llega como tarjeta (foto + caption), marcada como mensaje del agente.

- [x] T010 [US2] Modificar `src/server/ai/agent.ts`: en `action.send_sheet`, enviar la **tarjeta** vía `sendPropertyCard(...)` (en vez de `formatPropertySheet` + `sendAgentText`), conservando la anti-alucinación (la propiedad debe estar entre los `matches` del tenant) y `ai_generated=true`; degrada a texto si no hay foto (FR-003/004)

**Checkpoint**: El agente entrega la mejor ficha como tarjeta (SC-003).

---

## Phase 5: User Story 3 — Botones de acción en la tarjeta (Priority: P2)

**Goal**: La tarjeta lleva botones (Agendar visita / Hablar con asesor / Más fotos) y el tap dispara su acción.

**Independent Test**: Enviar una tarjeta con botones; tocar cada uno y verificar: agendar inicia el flujo de fecha (visita en 004), asesor hace handoff (005), más fotos envía hasta 5; tap idempotente.

- [x] T011 [US3] Añadir a `src/lib/meta/index.ts` `buildInteractiveButtonsPayload(to, { headerImageLink?, body, buttons })` → payload `type:"interactive"` (button) con header imagen opcional + body + hasta 3 `reply` buttons + tipo `SendInteractivePayload` (contrato §2)
- [x] T012 [US3] Extender en `src/lib/meta/index.ts` los **tipos de entrada**: `WhatsAppChangeValue.messages[].interactive.button_reply.{id,title}` (type `interactive`) — para parsear el tap
- [x] T013 [US3] Ampliar `src/server/inbox/ficha.ts`: ruta `withButtons` de `sendPropertyCard` → arma el interactivo (header imagen si hay foto, body caption, 3 botones con id `visit|handoff|photos:<propertyId>`); sin foto + botones → interactivo sin header (FC-2/FC-3); helper `sendMorePhotos(orgId, conv, propertyId)` que envía **hasta 5** fotos adicionales o avisa si no hay
- [x] T014 [US3] Crear `src/server/inbox/buttons.ts` `handleButtonReply(orgId, conv, buttonId)`: parsea `<acción>:<propertyId>`, valida la propiedad del tenant y rutea — **visit**: marca la propiedad como principal de la conversación + envía prompt de fecha (con agente activo su `schedule_visit` de 004 cierra; con agente off, `needs_human` para el asesor); **handoff**: `needs_human=true`+`needs_human_reason='requested'` (005) + confirma; **photos**: `sendMorePhotos` (T013). Degrada con gracia, sin secretos (contrato §4; FR-008/009/010/012)
- [x] T015 [US3] Modificar `src/server/inbox/ingest.ts`: cuando `msg.type==="interactive"`, persistir el entrante (`wa_type:"interactive"`, `body`=título del botón) y, si es **nuevo** (idempotente por `wa_message_id`), `after(() => handleButtonReply(...))`; preservar el gate insert-nuevo + UNIQUE (FR-011/SC-006)
- [x] T016 [US3] Activar los botones en **ambos** emisores (clarify): el endpoint manual (T007) y el `send_sheet` del agente (T010) llaman `sendPropertyCard(..., { withButtons:true })`

**Checkpoint**: La tarjeta es interactiva; cada botón ejecuta su acción de forma idempotente y agente-agnóstica.

---

## Phase 6: Polish & Cross-Cutting

- [x] T017 [P] Auditoría de aislamiento: `propertyId` (manual y de botón) y las fotos se validan contra el tenant; ningún cruce (FR-005/FR-015/SC-007)
- [x] T018 [P] Auditoría de secretos + idempotencia: la URL prefirmada no expone credenciales; el token de WhatsApp y las llaves S3 no se loguean; el tap repetido = una sola acción (FR-011/FR-016/SC-006)
- [x] T019 Ejecutar la puerta de calidad: `pnpm typecheck && pnpm lint && pnpm build` en verde (SC-008 parte automática)

---

## Phase 7: Self-test de comportamiento (cierre del sprint) 🔴 obligatorio

**Goal**: Corroborar que la ficha llega como **una** tarjeta (foto + caption) y que los botones disparan su acción. Reusa el guardrail de allowlist + anti-ráfaga de Evolution.

> **Estado (2026-06-20)**: código implementado y puerta de calidad en verde (T001–T019). Scaffold del
> self-test creado (T020). **T021–T024 pendientes de verificación humana / live**: requieren deploy a
> inmox-dev con la migración 0003 aplicada. El **tap de botón** no es automatizable por el tester
> guardado (Evolution no emite `button_reply`) → se toca en el teléfono real. El envío de la tarjeta
> (T021) sí es verificable con `scripts/wa-tester/ficha-card.mjs`.

- [x] T020 Crear `scripts/wa-tester/ficha-card.mjs`: andamiaje que abre la conversación de prueba y dispara el envío de una ficha (vía `POST /ficha`); verifica que el saliente quedó con `property_id` y tipo imagen/interactivo
- [ ] T021 [P] P1: con una propiedad **con** foto, enviar ficha (a) desde el **botón manual** y (b) provocando el **`send_sheet` del agente** (con el agente activo) → verificar que ambas llegan como **un solo** mensaje con foto + caption (la del agente marcada como IA); repetir con una **sin** foto → ficha de texto (degradación) (SC-001/SC-002/SC-003/SC-004)
- [ ] T022 [P] P2: verificar botones visibles y tocar cada uno — "Agendar visita" inicia fecha (visita en `/showings`), "Hablar con asesor" → handoff "Pidió un asesor", "Más fotos" → hasta 5 fotos; tap repetido = una sola acción (SC-005/SC-006). (El tap puede requerir tocarlo en el teléfono → verificación humana si Evolution no emite `button_reply`.)
- [ ] T023 Desplegar a inmox-dev (rama 006), aplicar la migración aditiva y correr el self-test contra el entorno real; iterar/autocorregir; dejar evidencia
- [ ] T024 Recorrer `quickstart.md` (checklist de cierre, incl. no-regresión del agente/ventana 24 h) y declarar el sprint hecho solo con todo en verde

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** bloquea todo (esquema + payload imagen + `sendPropertyCard`).
- **US1 (3)** y **US2 (4)** (P1): consumen `sendPropertyCard`; independientes entre sí.
- **US3 (5)** (P2): añade la capa interactiva (payload de botones + tipos de entrada + ruteo); depende de Foundational y **complementa** US1/US2 (activa los botones en ambos emisores, T016).
- **Polish (6)** y **Self-test (7)**: tras las historias; el Self-test cierra el sprint.

### User Story Dependencies

- US1 (P1) → Foundational. Toca endpoint + `messages` GET + `inbox-client`.
- US2 (P1) → Foundational. Toca `agent.ts` (independiente de US1).
- US3 (P2) → Foundational; toca `lib/meta` (T011/T012, coordinar con T004), `ficha.ts` (T013, coordinar con T005), `ingest.ts` (T015) y reusa 004/005.

### Within Each Story

- Esquema/payload antes que el envío; el envío antes que el endpoint/UI; el ruteo del tap tras los tipos de entrada; el self-test al final.

### Parallel Opportunities

- En Foundational, T002 (schema) y T004 (`lib/meta` imagen) son archivos distintos → posible [P]; T003 depende de T002.
- En US1, T008 (`messages` route) y T009 (`inbox-client`) son archivos distintos → posible [P].
- T017 y T018 (auditorías) en paralelo. T021 y T022 (casos del self-test) en paralelo (comparten el script T020).

---

## Implementation Strategy

### MVP (P1: la tarjeta funciona y el botón manual ya envía)

1. Setup + Foundational (esquema, payload imagen, `sendPropertyCard`).
2. US1 (botón manual entrega la tarjeta) + US2 (el agente la envía como tarjeta).
3. **Self-test parcial**: la ficha llega como una tarjeta con foto + caption.

### Incremental

4. US3 (botones interactivos + ruteo: agendar/asesor/más fotos).
5. Polish (auditorías + puerta de calidad).
6. **Phase 7 Self-test completo** (tarjeta + botones) → cierre del sprint con evidencia.

---

## Notes

- Frontera Meta en `src/lib/meta`; **no** se toca el contrato del webhook (firma/idempotencia); el
  `button_reply` entra por el mismo camino idempotente (UNIQUE `wa_message_id`).
- Foto vía **URL prefirmada** de R2 (`getDownloadUrl`), interfaz S3 estándar; no se sube media a Meta.
- "Hecho" = typecheck + lint + build **+ self-test** (tarjeta + botón); lo no automatizable (tocar el
  botón en el teléfono) se marca como verificación humana.
- **Sin carrusel** (descartado por el dueño). El **agente multimodal** (entrada: STT/visión) es una
  feature aparte, no entra en 006.
