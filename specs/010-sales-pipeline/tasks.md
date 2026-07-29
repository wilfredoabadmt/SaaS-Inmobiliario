---
description: "Task list for 010-sales-pipeline"
---

# Tasks: Pipeline de ventas real

**Input**: Design documents from `specs/010-sales-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md (DV-SP-1…7), data-model.md, contracts/pipeline.md, quickstart.md

**Tests**: Este proyecto NO usa suite de tests unitarios/TDD. "Hecho" = typecheck + lint + build **+
self-test E2E de comportamiento** (constitución V + CLAUDE.md). Por eso no hay tareas de test unitario;
la verificación va como tareas de cierre (Fase 8, basadas en quickstart.md).

**Organización**: por user story (US1…US5) sobre una base Foundational. La **migración con backfill** es el
bloqueante crítico.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1…US5 (mapea a las user stories del spec)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencias y andamiaje compartido.

- [X] T001 Añadir dependencia cliente de drag-and-drop: `pnpm add @dnd-kit/core` (DV-SP-3); verificar que queda en el allowlist de build de pnpm si aplica
- [X] T002 [P] Añadir prefijo de id `pipeline_stage` (p. ej. `pst_`) en `src/lib/db/ids.ts`
- [X] T003 [P] Crear tipos compartidos del tablero en `src/lib/pipeline/types.ts` (`BoardData`, `StageView`, `DealCard`, `StageKind = 'normal'|'won'|'lost'|'visit'`)
- [X] T004 [P] Crear esquemas Zod compartidos en `src/lib/pipeline/schemas.ts` (crear trato, mover/asignar, crear/renombrar/reordenar/eliminar etapa) según contracts/pipeline.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: esquema + migración + helpers que TODAS las stories necesitan. ⚠️ Ninguna user story puede
empezar hasta cerrar esta fase. La migración y el cambio de `showings/service.ts` se despliegan JUNTOS.

- [X] T005 Definir tabla `pipeline_stage` en `src/lib/db/schema/domain.ts` (org-scoped: `id`, `organization_id`, `label`, `sort_order`, `kind` default `'normal'`, `color` nullable, timestamps) con índices `(org, sort_order)` y **unique parcial** `(org, kind) WHERE kind <> 'normal'` (una sola ancla won/lost/visit por org)
- [X] T006 Modificar `candidacy` en `src/lib/db/schema/domain.ts`: quitar `stage` (enum) → añadir `stage_id text NOT NULL REFERENCES pipeline_stage ON DELETE RESTRICT`; `property_id` → **nullable** + `ON DELETE SET NULL`; añadir **unique parcial** `(org, client) WHERE property_id IS NULL`; conservar unique `(org, client, property)`; índice `(org, stage_id)` (depende de T005)
- [X] T007 Generar la migración Drizzle y escribir el **backfill seed-then-map** en `drizzle/` siguiendo el orden exacto de data-model.md §3 (crear tabla → sembrar 8 etapas por org → `ADD stage_id` nullable → `UPDATE` map enum→fila por label → `SET NOT NULL`+FK → `DROP COLUMN stage` → `property_id` nullable+FK set null → uniques) (depende de T005, T006)
- [X] T008 [P] Implementar en `src/server/pipeline/stages.ts`: `seedDefaultStages(orgId)` **idempotente** (8 etapas con `kind`/`sort_order`/`color` desde `src/lib/design/status.ts`), `resolveAnchorStage(orgId, kind)`, `resolveInitialStage(orgId)` (menor `sort_order`) y `advanceStageForward(orgId, dealId, targetStageId)` (mueve **solo si** `target.sort_order > actual.sort_order`; no-op si no — regla de avance DV-SP-8)
- [X] T009 Modificar `src/server/showings/service.ts` `ensureCandidacy` (DV-SP-8, resuelve F1): resolver ancla `visit`; si el trato cliente↔propiedad existe → `advanceStageForward(... visit)` (no retrocede); si el cliente solo tenía trato **sin-propiedad** (auto-alta) → **promover** (asociar la propiedad + avanzar) en vez de duplicar; si no hay ninguno → `INSERT` en el ancla `visit`. Deploy-coupled con T007 (depende de T008)
- [X] T009b Modificar `src/server/inbox/ingest.ts` (DV-SP-6): tras el auto-alta/enriquecimiento del contacto (009), si el cliente no tiene ningún trato, `INSERT` un `candidacy` con `property_id = NULL` y `stage_id = resolveInitialStage(org)`, **idempotente** (`onConflictDoNothing` sobre el unique parcial `(org,client) WHERE property_id IS NULL`) → todo inbound aparece en "Nuevo" sin duplicar (depende de T008, T006)

**Checkpoint**: esquema migrado con datos preservados; ancla `visit` y etapa inicial resuelven por rol; todo inbound entra al tablero; regla de avance lista. Las user stories pueden empezar.

---

## Phase 3: User Story 1 - Tablero real + mover persistente (Priority: P1) 🎯 MVP

**Goal**: `/pipeline` muestra los tratos reales de la org agrupados por etapa; se puede crear un trato y
moverlo entre etapas con persistencia y aislamiento de tenant.

**Independent Test**: con un trato real, verlo en su columna, crear otro (con/sin propiedad), moverlo con los
chevrons, recargar y confirmar persistencia; otra org no ve estos tratos.

- [X] T010 [P] [US1] `getBoard(orgId)` en `src/server/pipeline/board.ts`: etapas ordenadas + tratos agrupados (join client/property/agent), **omitiendo** tratos con `client.archivedAt` o `property.archivedAt` (007/009); siembra etapas si la org no tiene (llama `seedDefaultStages`)
- [X] T011 [P] [US1] `createDeal(orgId, {clientId, propertyId?, stageId?})` y `moveDeal(orgId, dealId, stageId)` en `src/server/pipeline/deals.ts`: validan client/property/stage de la org (404/400), unicidad (409 `duplicate_deal`), default stage = primera (`sort_order` min)
- [X] T012 [US1] `GET /api/pipeline` en `src/app/api/pipeline/route.ts` (`requireMember`) → `BoardData`; `authErrorResponse` para errores de guard (depende de T010)
- [X] T013 [US1] `POST /api/pipeline/deals` en `src/app/api/pipeline/deals/route.ts` (`requireMember`, Zod) → crear trato (depende de T011)
- [X] T014 [US1] `PATCH /api/pipeline/deals/[id]` en `src/app/api/pipeline/deals/[id]/route.ts` (`requireMember`, Zod) aceptando `{stageId}` → `moveDeal`; scoped (otra org → 404); mover a etapa inexistente → 400 `invalid_stage` (depende de T011)
- [X] T015 [US1] Reescribir `src/app/(dashboard)/pipeline/page.tsx`: server component que carga `getBoard` real (elimina dependencia de `SAMPLE_LEADS`) y pasa `BoardData` al board
- [X] T016 [US1] Reescribir `src/components/pipeline/pipeline-board.tsx` para datos reales (columnas desde `stages`, agrupar por `stageId`) y mover con los chevrons llamando `PATCH …/deals/[id]` (optimistic + revertir si falla); quitar el estado mock
- [X] T017 [P] [US1] Crear `src/components/pipeline/deal-card.tsx`: tarjeta con cliente, propiedad (o "sin propiedad"), operación (badge renta/venta) y agente asignado (inicial) o "Sin asignar"
- [X] T018 [US1] UI de alta mínima "Nuevo trato" en el board (botón + hoja/modal: seleccionar cliente real de 009, propiedad opcional) que llama `POST /api/pipeline/deals` y refresca (depende de T013, T016)

**Checkpoint**: MVP funcional — tablero real, crear, mover, persistir, aislado por tenant.

---

## Phase 4: User Story 2 - Etapas configurables por agencia (Priority: P2)

**Goal**: el dueño personaliza el embudo (renombrar/agregar/eliminar/reordenar) desde `/pipeline`; anclas
won/lost/visit no eliminables; cambios visibles para el equipo.

**Independent Test**: como owner renombrar+reordenar una etapa intermedia y ver el tablero reflejarlo;
impedir borrar ancla y borrar etapa con tratos; un agente no accede a la configuración.

- [X] T019 [US2] Extender `src/server/pipeline/stages.ts` con `listStages(orgId)` (con `deletable = kind==='normal'` y `dealCount`), `createStage`, `renameStage`, `reorderStages(orderedIds)`, `deleteStage(id, reassignToStageId?)` (guards: ancla → `anchor_stage`; con tratos sin reasignar → `stage_not_empty`)
- [X] T020 [P] [US2] `GET /api/pipeline/stages` + `POST` en `src/app/api/pipeline/stages/route.ts` (`requireOwner`, Zod) (depende de T019)
- [X] T021 [P] [US2] `PATCH`/`DELETE /api/pipeline/stages/[id]` en `src/app/api/pipeline/stages/[id]/route.ts` (`requireOwner`: renombrar/reordenar; eliminar con guards de ancla y de tratos) (depende de T019)
- [X] T022 [P] [US2] `PUT /api/pipeline/stages/order` en `src/app/api/pipeline/stages/order/route.ts` (`requireOwner`): reordenar atómico; valida que `orderedIds` = conjunto exacto de la org (400 `invalid_order`) (depende de T019)
- [X] T023 [US2] Crear `src/components/pipeline/stage-config.tsx`: modo "Configurar etapas" (renombrar/agregar/eliminar/reordenar; anclas marcadas no eliminables) que consume los endpoints de etapas
- [X] T024 [US2] Integrar el botón "Configurar etapas" en el board **solo para owner** (rol del contexto) y refrescar el tablero al guardar (depende de T016, T023)

**Checkpoint**: el embudo es propio de cada agencia; anclas protegidas; solo owner edita.

---

## Phase 5: User Story 3 - Drag-and-drop + scroll cómodo (Priority: P2)

**Goal**: mover tratos arrastrándolos (clic-y-arrastrar) además de los chevrons; soltar fuera = no-op;
scroll horizontal del tablero y vertical de columnas cómodo.

**Independent Test**: arrastrar una tarjeta a otra columna persiste (igual que botón); soltar fuera no
cambia nada; columna con muchas tarjetas hace scroll con la rueda.

- [X] T025 [US3] Integrar `@dnd-kit/core` en `src/components/pipeline/pipeline-board.tsx`: `DndContext` + `useDroppable` por columna; `onDragEnd` → `PATCH …/deals/[id]` con la etapa destino; sin `over` (fuera de columna) → no-op (FR-016); `PointerSensor` + `KeyboardSensor` (accesible)
- [X] T026 [US3] Hacer `src/components/pipeline/deal-card.tsx` draggable (`useDraggable`) con **activation constraint** (distancia mínima) para distinguir **clic** de **arrastre** (clic se reserva para el drawer de US4); conservar los chevrons como fallback (FR-015)
- [X] T027 [P] [US3] Arreglar el scroll en `pipeline-board.tsx`: contenedor `overflow-x-auto`; cuerpo de cada columna `flex-1 overflow-y-auto` con altura acotada (rueda del mouse) (FR-017)

**Checkpoint**: arrastre cómodo y accesible; scroll resuelto; los chevrons siguen funcionando.

---

## Phase 6: User Story 4 - Panel de detalle al abrir tarjeta (Priority: P3)

**Goal**: clic en una tarjeta abre un drawer con cliente + requisitos + propiedad + últimos mensajes y
"Abrir en bandeja" (deep-link) + enlace a la ficha de propiedad.

**Independent Test**: clic en tarjeta → drawer con datos reales; "Abrir en bandeja" cae en la conversación
correcta; trato sin propiedad/sin conversación degrada con estado vacío.

- [X] T028 [US4] `getDealDetail(orgId, dealId)` en `src/server/pipeline/queries.ts`: compone client (name/phone/channel), `client_requirements` (004), property + foto principal (URL prefirmada `getDownloadUrl` de 007), `conversationId` vía `getOrCreateConversation` (009) y últimos ~5 mensajes; scoped (otra org → null/404)
- [X] T029 [US4] `GET /api/pipeline/deals/[id]` en `src/app/api/pipeline/deals/[id]/route.ts` (`requireMember`) → detalle del panel (extiende el archivo de T014) (depende de T028)
- [X] T030 [US4] Crear `src/components/pipeline/deal-drawer.tsx`: drawer con secciones (cliente+badge canal, requisitos, propiedad+foto, resumen de mensajes), **"Abrir en bandeja"** → `/inbox?c=<conversationId>`, enlace a ficha de propiedad (deshabilitado si no hay), estados vacíos claros (FR-022)
- [X] T031 [US4] Cablear el **clic** de `deal-card.tsx` (no-arrastre, vía la activation constraint de T026) para abrir `deal-drawer.tsx` con el `dealId`; cargar el detalle al abrir (depende de T026, T030)

**Checkpoint**: las tarjetas se abren y muestran al cliente + su conversación + la propiedad; deep-link correcto.

---

## Phase 7: User Story 5 - Asignación real de agente (Priority: P3)

**Goal**: asignar/reasignar un trato a un miembro real de la org desde la tarjeta o el drawer; rechazar
no-miembros; "Sin asignar" válido.

**Independent Test**: asignar a un agente real persiste y se ve en la tarjeta; reasignar; asignar a un
no-miembro → 400; dejar "Sin asignar".

- [X] T032 [P] [US5] `listOrgMembers(orgId)` (id+nombre+rol) y `assignDeal(orgId, dealId, assignedAgentId|null)` en `src/server/pipeline/deals.ts`: valida que el destino sea `member` de la org (si no → `not_a_member`)
- [X] T033 [US5] Extender `PATCH /api/pipeline/deals/[id]` (archivo de T014) para aceptar `{assignedAgentId}` (incl. `null`) → `assignDeal`; 400 `not_a_member` (depende de T032)
- [X] T034 [P] [US5] `GET` de miembros para el selector: exponer `listOrgMembers` vía un endpoint o reusar uno existente del módulo de equipo (si existe) para poblar el selector
- [X] T035 [US5] Crear `src/components/pipeline/assign-agent.tsx`: selector de miembro de la org (o "Sin asignar") que llama el PATCH y refresca
- [X] T036 [US5] Integrar `assign-agent.tsx` en `deal-card.tsx` y/o `deal-drawer.tsx`; reflejar el agente (inicial) o "Sin asignar" (depende de T017, T030, T035)

**Checkpoint**: asignación real persistente; no-miembros rechazados; las 5 stories funcionan.

---

## Phase 8: Polish & Cross-Cutting Concerns + Cierre (Definición de Hecho REFORZADA)

**Purpose**: transversales y verificación de comportamiento (lo que de verdad cierra la feature).

- [~] T037 [P] Refresco del tablero entre miembros vía polling reusando `lib/realtime` (DV-SP-7) en `pipeline-board.tsx`. DIFERIDO: hoy hay **refresco bajo demanda** (re-fetch de `/api/pipeline` tras mover/asignar/configurar) y el spec acepta "tras un refresco/recargar" (SC-002/SC-003), así que el criterio se cumple con recarga manual. El **auto-poll por intervalo** entre miembros queda como mejora opcional (agencia 2–10 usuarios, baja contención).
- [X] T038 [P] Limpieza: marcar/retirar el uso de `SAMPLE_LEADS` del flujo de producción (queda solo en `dev-preview`), sin romper `src/app/dev-preview/pipeline/page.tsx`
- [X] T039 Gate técnico: `pnpm typecheck && pnpm lint && pnpm build` en verde
- [X] T040 Aplicar la migración en `inmox-dev` y **verificar conteos antes/después** (data-model §3 / quickstart): la distribución por etapa de los tratos vivos se preserva 1:1
- [X] T041 Desplegar a `inmox-dev` (migración + código en el MISMO deploy) y conducir el **self-test E2E feliz** (quickstart): **inbound del número de prueba → tarjeta auto-creada en "Nuevo"** → crear trato manual → mover (arrastre y chevron) → persistir → configurar etapas como owner → abrir panel → "Abrir en bandeja" correcto → asignar agente → **agendar visita avanza el trato a "Visita agendada"**
- [X] T042 Conducir el **self-test E2E camino infeliz** (quickstart): aislamiento de tenant (404), reasignar a no-miembro (400), borrar etapa con tratos (409) y ancla (400), mover a etapa inexistente (400), soltar fuera de columna (no-op), trato sin propiedad, **inbound repetido NO duplica tarjeta**, **agendar visita a un trato ya avanzado NO lo retrocede** (regla de avance)
- [X] T043 Marcar explícitamente **pendiente de verificación humana** lo no verificable por mí (estética/fluidez del arrastre, pulido visual del drawer)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: sin dependencias.
- **Foundational (P2)**: depende de Setup; **BLOQUEA** todas las user stories. La migración (T007) + showings (T009) se despliegan juntas.
- **US1 (P3)**: depende de Foundational. **MVP**.
- **US2 (P4)**, **US3 (P5)**: dependen de Foundational; se apoyan en el board de US1 (T016) para integrar UI.
- **US4 (P6)**, **US5 (P7)**: dependen de Foundational; US4 y US5 cablean sobre la tarjeta (T017) y el drawer; US4 antes de US5 para reutilizar el drawer como punto de asignación (opcional).
- **Polish (P8)**: depende de las stories deseadas; el cierre E2E (T041/T042) requiere todo lo que se quiera demostrar desplegado.

### User Story Dependencies

- **US1**: solo Foundational.
- **US2**: Foundational (+ T016 para el botón de config).
- **US3**: Foundational (+ T016/T017 para montar el DnD sobre el board real).
- **US4**: Foundational (+ T016/T017/T026 para el clic→drawer).
- **US5**: Foundational (+ T017/T030 para los puntos de asignación).

### Within Each User Story

- Servicios (`server/pipeline/*`) → endpoints (`api/*`) → UI (`components/pipeline/*`).
- Commit tras cada tarea o grupo lógico.

### Parallel Opportunities

- Setup: T002, T003, T004 en paralelo.
- Foundational: T008 en paralelo con T005/T006 (archivo distinto); T005→T006→T007 secuenciales (mismo `domain.ts`/migración).
- US1: T010, T011, T017 en paralelo (archivos distintos); endpoints (T012–T014) tras sus servicios.
- US2: T020, T021, T022 en paralelo tras T019.
- Polish: T037, T038 en paralelo; luego gate (T039) → migración (T040) → deploy + E2E (T041, T042).

---

## Parallel Example: Foundational

```bash
# Tras T005/T006/T007 (schema+migración), en paralelo (archivos distintos):
Task: "T008 seedDefaultStages + resolveAnchorStage en src/server/pipeline/stages.ts"
# (T009 showings depende de T008)
```

## Parallel Example: User Story 1

```bash
# Servicios y tarjeta en paralelo (archivos distintos):
Task: "T010 getBoard en src/server/pipeline/board.ts"
Task: "T011 createDeal/moveDeal en src/server/pipeline/deals.ts"
Task: "T017 deal-card.tsx"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational (incl. migración con backfill verificada) → 3. Phase 3 US1 →
   **STOP y VALIDAR**: tablero real + crear + mover + persistir + aislamiento. Deploy/demo si listo.

### Incremental Delivery

Foundational → **US1 (MVP)** → US2 (etapas configurables) → US3 (drag-and-drop) → US4 (panel) →
US5 (asignación) → Polish + cierre E2E. Cada story agrega valor sin romper las previas.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- La pieza de riesgo es la **migración con backfill** (T007/T040): probar en `inmox-dev` y comparar conteos
  antes de declarar hecho.
- Migración (T007) y `showings/service.ts` (T009) **van en el mismo deploy** (el código viejo rompe con el
  esquema nuevo).
- Cierre real = T041/T042 (self-test E2E feliz + infeliz) por mí; T043 = lo visual queda pendiente humano.
