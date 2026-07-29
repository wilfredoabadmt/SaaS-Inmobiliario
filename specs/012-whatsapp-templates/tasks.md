---
description: "Task list — 012-whatsapp-templates"
---

# Tasks: Gestión de plantillas de WhatsApp (012-whatsapp-templates)

**Input**: Design documents from `specs/012-whatsapp-templates/`
**Prerequisites**: plan.md, spec.md, research.md (DV-WT-1…12), data-model.md, contracts/api.md, quickstart.md

**Tests**: NO se generan tareas de test unitario/TDD (no solicitadas). La verificación es el **gate**
(typecheck+lint+build) + el **self-test E2E de comportamiento** (Definición de Hecho reforzada), en la fase
final — igual que las features 005–011.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1…US5 (mapea a las historias del spec). Setup/Foundational/Polish sin etiqueta.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificaciones previas; sin dependencias nuevas que instalar.

- [x] T001 Verificado EN VIVO (2026-06-26): debug_token confirma que el System User token tiene `whatsapp_business_management` + `whatsapp_business_messaging` (válido, no expira hasta ~2026). Gate de credenciales PASA.
- [x] T002 Confirmar que `META_APP_ID`, `META_GRAPH_API_VERSION`, `META_APP_SECRET` y `META_WEBHOOK_VERIFY_TOKEN` están presentes en `src/lib/env.ts` (ya existen) — no se añaden vars nuevas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema, modelo canónico, cliente de gestión y credenciales — bloquean TODAS las historias.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [x] T003 Extender el esquema en `src/lib/db/schema/domain.ts`: añadir a `template` las columnas `waTemplateId`, `status`, `rejectedReason`, `qualityRating`, `components` (jsonb), `lastSyncedAt`; añadir índice único `template_org_name_lang_uq` (org+wa_template_name+language). (data-model §1)
- [x] T004 Añadir tabla `templateAnalytics` en `src/lib/db/schema/domain.ts` (id, organizationId, templateId, day, sent, delivered, read, clicked, cost, currency, fetchedAt) + índices `template_analytics_tpl_day_uq` y `template_analytics_org_idx`. (data-model §2)
- [x] T005 Añadir prefijo de id `templateAnalytics` en `src/lib/db/ids.ts`.
- [x] T006 Escribir la migración `drizzle/0011_whatsapp_templates.sql` (ALTER TABLE template ADD COLUMN … + CREATE TABLE template_analytics + índices) y añadir la entrada idx 11 a `drizzle/meta/_journal.json` (patrón gotcha-drizzle-data-migration: a mano).
- [x] T007 [P] Crear `src/lib/meta/templates.ts`: modelo canónico de componentes (tipos + Zod), `toMetaComponents(canonical)` (→ shape de Graph API), `fromMetaComponents(meta)` (← parseo al sincronizar), `renderBody(text, values)` (sustituye `{{i}}`), y validación variables↔ejemplos. (data-model §3, DV-WT-4)
- [x] T008 Extender `src/lib/meta/index.ts`: `createMessageTemplate(wabaId, token, payload)`, `listMessageTemplates(wabaId, token)` (paginado), `deleteMessageTemplate(wabaId, token, {name, hsmId})`, `getTemplateAnalytics(wabaId, token, {start, end, templateIds})`, `uploadResumableSample(appId, token, bytes, mime)` → handle; + tipos. Reusa `graphRequest`/`MetaApiError`. (DV-WT-3, DV-WT-5, DV-WT-7)
- [x] T009 [P] Añadir helper de mapeo de errores de Meta a mensaje legible + detección de token inválido (190/OAuthException) en `src/lib/meta/index.ts` o `src/server/whatsapp/templates.ts` (DV-WT-10, DV-WT-11).
- [x] T010 Extender `src/server/whatsapp/credentials.ts`: `getManagementCredentials(org) → { wabaId, token } | null` (server-only) y `resolveOrgByWabaId(wabaId) → orgId | null` (para el webhook). (DV-WT-3, DV-WT-6)
- [x] T011 Crear `src/server/whatsapp/templates.ts` (servicio de dominio): orquesta lib/meta + Drizzle con scope por org y degradación — funciones `createTemplate`, `listTemplatesWithStatus`, `syncTemplates`, `deleteTemplate`, `getAnalytics` (caché). Marca `metaCredentials.status='expired'` ante token inválido. (DV-WT-8…11)

**Checkpoint**: esquema + cliente + servicio listos; las historias pueden comenzar.

---

## Phase 3: User Story 1 - Crear plantilla y enviarla a revisión (Priority: P1) 🎯 MVP

**Goal**: El owner crea una plantilla (builder práctico) y la envía a revisión; aparece como "Pendiente".

**Independent Test**: Crear una plantilla válida desde `/templates` → WhatsApp la acepta, aparece en la lista
con estatus "Pendiente" y se guarda su contenido/categoría.

- [x] T012 [US1] Implementar `POST /api/templates` en `src/app/api/templates/route.ts` (REEMPLAZA el insert local actual): `requireOwner`, valida (Zod + snake_case), traduce a components de Meta, llama `createTemplate`, inserta fila con `wa_template_id`+`status`; sin fila si Meta rechaza la creación (mensaje legible). (contracts: POST /api/templates)
- [x] T013 [US1] Actualizar `GET /api/templates` en el mismo archivo (`requireMember`) para devolver estatus/categoría/componentes/razón/calidad/lastSyncedAt vía `listTemplatesWithStatus`. (contracts: GET /api/templates)
- [x] T014 [US1] Implementar `POST /api/templates/upload-sample` en `src/app/api/templates/upload-sample/route.ts` (`requireOwner`) → `uploadResumableSample` → `{ handle }` para header de imagen. (DV-WT-5)
- [x] T015 [P] [US1] Crear la sección server `src/app/(dashboard)/templates/page.tsx` (lista las plantillas de la org vía servicio) + entrada de navegación "Plantillas" en el layout/sidebar del dashboard.
- [x] T016 [P] [US1] Crear el **builder** (componente client) en `src/components/templates/` : formulario categoría/idioma + header (texto/imagen con subida de muestra) + body con variables y ejemplos + footer + botones; preview en vivo (`renderBody`); validación previa; POST a `/api/templates`.
- [x] T017 [US1] Lista (componente client) en `src/components/templates/` que muestra cada plantilla con su estatus básico (badge) y un botón "Nueva plantilla" que abre el builder; manejar errores legibles (duplicado/inválido/`reconnect_required`/`not_connected`).

**Checkpoint**: US1 funcional — crear y ver "Pendiente" de punta a punta.

---

## Phase 4: User Story 2 - Ver y sincronizar el estatus de revisión (Priority: P2)

**Goal**: La lista refleja el estatus real (Aprobada/Rechazada/Pendiente/Pausada) + razón; sync automático
(webhook) y bajo demanda (botón).

**Independent Test**: Una plantilla pendiente pasa a Aprobada/Rechazada vía webhook o botón Sincronizar; las
rechazadas muestran razón.

- [x] T018 [US2] Extender `src/app/api/webhooks/whatsapp/route.ts`: si `change.field === "message_template_status_update"`, resolver org por `entry.id` (waba_id) con `resolveOrgByWabaId` y llamar al ingest — NO descartar por falta de `phone_number_id` (gotcha DV-WT-6).
- [x] T019 [US2] Implementar `processTemplateStatusUpdate(orgId, value)` en `src/server/inbox/ingest.ts` (o `src/server/whatsapp/templates.ts`): localizar fila por `wa_template_id`/`name+language`, aplicar `status`+`rejected_reason`+`last_synced_at`. Idempotente. Tipos de webhook en `src/lib/meta/index.ts`.
- [x] T020 [US2] Implementar `POST /api/templates/sync` en `src/app/api/templates/sync/route.ts` (`requireOwner`) → `syncTemplates` (pull paginado + upsert; marca `not_found` las sin correspondencia). (contracts: POST /api/templates/sync)
- [x] T021 [P] [US2] UI: badges de estatus (Aprobada/Rechazada/Pendiente/Pausada/Otro) + razón de rechazo visible + botón "Sincronizar" en `src/components/templates/`.

**Checkpoint**: estatus real confiable (push + pull).

---

## Phase 5: User Story 3 - Enviar plantilla aprobada con variables desde la bandeja (Priority: P2)

**Goal**: Fuera de la ventana de 24 h, el asesor envía una plantilla aprobada rellenando variables.

**Independent Test**: En una conversación fuera de 24 h, elegir plantilla aprobada con variables, rellenar,
enviar → llega con valores sustituidos y aparece en el hilo.

- [x] T022 [US3] Extender `POST /api/conversations/[id]/messages/template/route.ts`: aceptar `variables[]`, validar plantilla APPROVED + de la org + `variables.length === body.variables`, construir `template.components`, enviar, insertar `message` con `body` renderizado + `template_id`. (contracts + DV-WT-9)
- [x] T023 [US3] Extender `listTemplates`/queries en `src/server/inbox/queries.ts` para el selector de la bandeja: devolver SOLO plantillas APPROVED con sus variables/componentes.
- [x] T024 [US3] Extender `src/components/inbox/chat-thread.tsx`: al elegir plantilla con variables, mostrar inputs por variable + preview (`renderBody`); bloquear envío si falta alguna; enviar `variables[]`.

**Checkpoint**: reactivación de conversación fuera de 24 h con plantilla + variables.

---

## Phase 6: User Story 4 - Eliminar una plantilla (Priority: P3)

**Goal**: El owner elimina una plantilla; se borra en Meta y desaparece de la sección.

**Independent Test**: Eliminar desde la UI → Meta confirma → ya no aparece; mensajes históricos intactos.

- [x] T025 [US4] Implementar `DELETE /api/templates/[id]/route.ts` (`requireOwner`) → `deleteTemplate` (`DELETE` en Meta por name+hsm_id, luego borra fila; no toca `message`). (contracts: DELETE /api/templates/[id])
- [x] T026 [US4] UI: acción de eliminar con confirmación en `src/components/templates/` (oculta/disabled para rol agente).

**Checkpoint**: ciclo de administración completo (crear→revisar→usar→eliminar).

---

## Phase 7: User Story 5 - Estadísticas de uso y costo (Priority: P3)

**Goal**: Por plantilla y rango, ver enviados/entregados/leídos/clics + costo real; resumen agregado.

**Independent Test**: Tras enviar, abrir stats → conteos coinciden con el rango; rango sin datos → "sin datos"
sin error; costo aparece si Meta lo expone.

- [x] T027 [US5] Implementar `GET /api/templates/[id]/analytics/route.ts` (`requireMember`): sirve de caché `template_analytics`; refresca vía `getTemplateAnalytics` si falta/expira TTL; upsert por día; `costAvailable` honesto. (contracts + DV-WT-7)
- [x] T028 [US5] Implementar `GET /api/templates/analytics/route.ts` (`requireMember`): resumen agregado de la agencia en el rango (desde caché). (contracts)
- [x] T029 [P] [US5] UI: panel de estadísticas (selector de rango, totales + serie + costo/"costo no disponible") en `src/components/templates/`.

**Checkpoint**: visibilidad de uso y costo.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Consistencia de degradación, gate y verificación de comportamiento.

- [x] T030 [P] Revisar degradación consistente en todos los endpoints: `reconnect_required` (token inválido + marca `expired`), `meta_unavailable` (5xx/timeout), `meta_error` (mensaje legible), `not_connected`; ninguno rompe la UI (DV-WT-10).
- [x] T031 [P] Verificar aislamiento de tenant en cada endpoint (scope por `organization_id`) y gating de permisos owner/member (DV-WT-8).
- [x] T032 Gate técnico: `pnpm typecheck && pnpm lint && pnpm build` en verde.
- [x] T033 Desplegado a inmox-dev (2026-06-26, commit `0d0dce2`): `running:healthy`, `/api/health` 200, migración 0011 aplicada (`[migrate] OK`), `/templates` y `/api/templates/**` vivos.
- [x] T034 Suscrito EN VIVO (confirmado por el dueño, 2026-06-26): campos `message_template_status_update` + `messages` en estado "Suscrito" (v25.0) en el panel de Meta.
- [x] T035 **Self-test E2E de comportamiento** — VERIFICADO EN VIVO por la app desplegada (2026-06-26):
  - ✅ Token con scope `whatsapp_business_management` + `whatsapp_business_messaging` (debug_token).
  - ✅ Envío de plantilla aprobada (`hello_world`) a `+52[TU_NUMERO_TESTER]` → Meta `accepted` + message id.
  - ✅ Login → `sync` (trae `hello_world` de Meta) → estatus **APPROVED** → **crear** plantilla (→ PENDING) → **eliminar** (borra en Meta + local).
  - ✅ Degradación: la analítica de un WABA sin stats devuelve **200 "sin datos"** (no rompe), y un `sync` exitoso hace **self-heal** de la conexión (`expired`→`connected`). Bug encontrado y corregido en el propio self-test (commit `0d0dce2`).
  - ✅ Permisos: `GET` protegido (401 sin sesión); escrituras = owner.
  - PENDIENTE DE VERIFICACIÓN HUMANA/META: (a) confirmar recepción visual del `hello_world` en el teléfono; (b) observar la transición real PENDING→APPROVED de una plantilla nueva (timing de Meta, min–24 h; webhook ya suscrito y ruteado); (c) **App Review** de `whatsapp_business_management` para producción; (d) envío con variables desde la bandeja por UI no se ejecutó para respetar el guardrail de "un solo mensaje" (mecanismo de envío ya probado vía Graph + validación cubierta).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 es un **gate de credenciales** (si falla, bloquea todo).
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias. (T003–T006 esquema/migración; T007–T011 cliente/servicio.)
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de Foundational; usa el servicio. Independiente de US1 (pero su valor se ve sobre plantillas creadas).
- **US3 (Phase 5)**: depende de Foundational; necesita plantillas APPROVED para probar (las da US1+US2 o una existente).
- **US4 (Phase 6)** y **US5 (Phase 7)**: dependen de Foundational; independientes entre sí.
- **Polish (Phase 8)**: tras las historias deseadas.

### Within Each User Story

- Modelos/servicio (Phase 2) antes de endpoints; endpoints antes de UI; core antes de integración.

### Parallel Opportunities

- T007 y T009 [P] (archivos distintos) en paralelo dentro de Foundational.
- T015 y T016 [P] (page vs builder) en paralelo dentro de US1.
- T021 [P] (UI badges) tras T018–T020.
- T029 [P] (UI stats) tras T027–T028.
- T030 y T031 [P] en Polish.
- Tras Foundational, US4 y US5 pueden ir en paralelo con US2/US3 (archivos distintos).

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup (sobre todo el **gate de credenciales** T001).
2. Phase 2 Foundational (esquema + migración + cliente + servicio).
3. Phase 3 US1 → **STOP & VALIDATE**: crear plantilla → "Pendiente" en la sección + en Meta.
4. Desplegar/demostrar.

### Incremental Delivery

US1 (crear/revisión) → US2 (estatus/sync) → US3 (envío con variables) → US4 (eliminar) → US5 (stats).
Cada historia añade valor sin romper las previas. Cierre = Phase 8 (gate + self-test E2E).

---

## Notes

- [P] = archivos distintos, sin dependencias. [Story] = trazabilidad a la historia del spec.
- Commit tras cada tarea o grupo lógico (convención `feat(012):`/`fix(012):`).
- La **aprobación de plantillas** la decide Meta (min–24 h) y la **App Review** de producción son **pendientes
  de verificación humana/Meta** (no bloquean el código, sí el "live" de producción).
- Evitar: tareas vagas, conflictos en el mismo archivo, dependencias cruzadas que rompan la independencia.
