---
description: "Task list — 009 Gestión de contactos vinculada a la bandeja"
---

# Tasks: Gestión de contactos vinculada a la bandeja

**Input**: Design documents from `specs/009-client-management/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: NO se generan tareas de tests automatizados. Por convención del proyecto (constitución V +
CLAUDE.md), la verificación es `typecheck + lint + build` **+ self-test E2E de COMPORTAMIENTO** que
conduce Claude (skill `whatsapp-ai-agent-selftest`). Va en la fase final (Polish/Verify).

**Organization**: tareas agrupadas por historia de usuario para implementación/validación independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: a qué historia pertenece (US1–US4)
- Rutas de archivo exactas incluidas en cada tarea

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: cambio de datos aditivo que habilita todo lo demás.

- [X] T001 Añadir columna aditiva `channel` (`text NOT NULL DEFAULT 'whatsapp'`) a la tabla `client` en `src/lib/db/schema/domain.ts` (mantener `client_org_phone_uq`). Ver data-model.md.
- [X] T002 Generar la migración Drizzle para `client.channel` (`drizzle/0006_large_wiccan.sql`: `ALTER TABLE "client" ADD COLUMN "channel" text DEFAULT 'whatsapp' NOT NULL;`). Backfilea existentes a 'whatsapp'; no destructiva. (depende de T001)

**Checkpoint**: el esquema soporta canal de origen. ✓

---

## Phase 2: Foundational (prerequisitos bloqueantes)

- [X] T003 [P] Crear `src/lib/clients/types.ts` (`CHANNELS`, `Channel`, `asChannel`, `ClientListItem`, `ClientDetail`).
- [X] T004 [P] Crear `src/lib/clients/schemas.ts` (Zod `clientCreateSchema`/`clientUpdateSchema`; teléfono → solo dígitos; email opcional validado).
- [X] T005 Extraer `getOrCreateConversation` de `ingest.ts` a `src/server/inbox/conversations.ts` (helper compartido) e importarlo en `ingest.ts`. Ver DV-CM-5.

**Checkpoint**: fundación lista. ✓

---

## Phase 3: User Story 1 - Gestionar contactos reales (Priority: P1) 🎯 MVP

- [X] T006 [P] [US1] `src/server/clients/queries.ts` → `listClients(orgId, q?)` con canal + última actividad + conversación más reciente, scoped por org.
- [X] T007 [P] [US1] `src/server/clients/service.ts` → `createClient` (channel='manual', unicidad→`phone_taken`), `updateClient`, `getClientDetail`.
- [X] T008 [US1] `src/app/api/clients/route.ts`: `POST` crear (201/422/409) y `GET` listar (`?q=`).
- [X] T009 [US1] `src/app/api/clients/[id]/route.ts`: `GET` detalle (404) y `PATCH` editar (200/422/404/409).
- [X] T010 [US1] `src/app/(dashboard)/clients/page.tsx`: `requireMember()` + `listClients` (sin `SAMPLE_CLIENTS`).
- [X] T011 [US1] `src/components/clients/client-form.tsx`: form crear/editar (recarga detalle en edición; muestra 409).
- [X] T012 [US1] `src/components/clients/clients-client.tsx`: datos reales (`ClientListItem`), búsqueda, "Nuevo contacto", editar.

**Checkpoint**: directorio de contactos real y funcional (MVP). ✓

---

## Phase 4: User Story 2 - Auto-alta y enriquecimiento desde la bandeja (Priority: P1)

- [X] T013 [US2] `getOrCreateClient` en `src/server/inbox/ingest.ts`: insert `channel='whatsapp'`; `onConflictDoUpdate` con `COALESCE(name)` y `channel` manual→real; idempotente. Ver DV-CM-4.

**Checkpoint**: cada inbound nuevo queda trazado con su canal; sin duplicados. ✓ (verificación de comportamiento en T021)

---

## Phase 5: User Story 3 - Badge de canal sobre el avatar (Priority: P2)

- [X] T014 [P] [US3] `src/components/clients/channel-badge.tsx`: overlay; SVG WhatsApp, `Instagram`/`MessageCircle` placeholders, `Pencil` neutro para manual.
- [X] T015 [US3] Integrar `ChannelBadge` en el avatar de `clients-client.tsx`.

**Checkpoint**: origen de cada contacto legible de un vistazo. ✓

---

## Phase 6: User Story 4 - "Enviar mensaje" como atajo a la bandeja (Priority: P2)

- [X] T016 [US4] `src/app/api/clients/[id]/conversation/route.ts`: `POST` get-or-create → `{ conversationId }` (404 si otra org).
- [X] T017 [P] [US4] Deep-link: `inbox/page.tsx` lee `searchParams.c`; `inbox-client.tsx` acepta `initialConversationId` y lo preselecciona (ignora `c` ajeno). Ver DV-CM-3.
- [X] T018 [US4] Acción "Enviar mensaje" en `clients-client.tsx`: `POST .../conversation` → `router.push("/inbox?c=<id>")`.

**Checkpoint**: agenda conectada con la bandeja, sin duplicar reglas de canal. ✓

---

## Phase 7: Polish & Verificación (cross-cutting)

- [X] T019 Gate técnico verde: `pnpm typecheck` ✓ + `pnpm lint` ✓ + `pnpm build` ✓.
- [X] T020 Desplegado a inmox-dev (Coolify), rama `009-client-management`, commit `85430d7`. `running:healthy`; `/api/health` → 200; `/clients` → 200. **Migración 0006 aplicada por migrate-on-boot** (`migrate.mjs` del Dockerfile; el proyecto NO usa Pre-Deployment Command). OJO: la rama del app en Coolify quedó en `009-client-management`; al mergear hay que regresarla a `main`.
- [X] T021 Self-test E2E **TODO VERDE** (`scripts/wa-tester/clients-009-selftest.mjs`): CRUD + 409 (crear y editar) + 404 sin fuga; deep-link get-or-create + shell 0 mensajes (→ bandeja exige plantilla); auto-alta desde inbound REAL (canal=whatsapp, sin duplicar, `COALESCE` preservó el nombre). **Pendiente verificación humana**: juicio visual del badge sobre el avatar y del compositor de plantilla en la bandeja.

---

## Adición post-spec: Archivar contacto (pedido del dueño)

El borrado quedó fuera de alcance en la spec; el dueño pidió poder "eliminar". Decisión: **archivar**
(soft-delete reversible, como propiedades 007) en vez de borrado duro, porque el borrado arrastraba en
cascada conversación/mensajes/candidaturas/contratos.

- [X] T022 Columna aditiva `client.archived_at` + índice (`src/lib/db/schema/domain.ts`) + migración `drizzle/0007_woozy_stark_industries.sql`.
- [X] T023 `setArchived` (`src/server/clients/service.ts`) + `listClients` excluye archivados por defecto, con filtro `archived` (`src/server/clients/queries.ts`).
- [X] T024 `POST /api/clients/[id]/archive` (`{archived:boolean}`) + Zod `clientArchiveSchema`.
- [X] T025 Reactivación por inbound: `ingest.ts` setea `archived_at=null` en el `onConflictDoUpdate` (reaparece con su historial).
- [X] T026 UI: toggle "Archivados" + acción Archivar/Restaurar en `clients-client.tsx`.

## Estado

- **T001–T021 + T022–T026 HECHAS y verificadas en vivo** (gate verde + self-test E2E verde contra inmox-dev).
- **Auto-alta + reactivación** verificadas con **simulación de webhook firmado** (`webhook-sim-009.mjs`)
  porque el número de prueba de Meta en modo Dev no entrega los inbounds del tester de forma fiable (no es
  bug: el camino webhook→ingest funciona y el `phone_number_id` está bien mapeado).
- **Visual del badge**: confirmado por el dueño ("se ve bien").
- **Pendiente del dueño**: **merge a `main`** (acción hacia afuera; al hacerlo, regresar la rama del app en
  Coolify de `009-client-management` a `main` y redesplegar).
- **Hallazgo de seguridad aparte (pendiente)**: los logs de build de Coolify exponen secretos como Docker
  ARGs (viola Principio I de la constitución).

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- `src/lib/meta` (ventana 24h, plantillas) **no se tocó**: la bandeja es la única dueña de las reglas.
- Migración **aditiva**; `DEFAULT 'whatsapp'` = backfill correcto.
- Total: **21 tareas** (Setup 2 · Foundational 3 · US1 7 · US2 1 · US3 2 · US4 3 · Polish 3).
