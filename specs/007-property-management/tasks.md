---
description: "Task list — Administración de propiedades (inventario CRUD real) (007)"
---

# Tasks: Administración de propiedades (inventario CRUD real)

**Input**: Design documents from `specs/007-property-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/property-management.md, quickstart.md

**Tests**: No se generan tests unitarios automatizados (no solicitados). La verificación es
typecheck + lint + build **+ self-test de comportamiento E2E** (Definición de Hecho reforzada):
crear→foto→estatus→archivar→match inverso + camino infeliz (ver Fase 8 y quickstart.md).

**Organization**: Tareas agrupadas por historia (US1–US5) en orden de prioridad (P1→P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: A qué historia pertenece (US1–US5)

## Path Conventions

Web app monolítica Next.js (App Router): `src/app/`, `src/components/`, `src/lib/`, `src/server/`.
Dominio en `src/server/properties`; frontera S3 en `src/lib/storage` (sin tocar); reuso del engine de
matching (`src/server/matching`) y del servicio de requisitos (`src/server/requirements`). Contratos:
`contracts/property-management.md`.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirmar que NO se requieren dependencias nuevas (se reusa Drizzle, Zod, `@aws-sdk/client-s3` ya presentes, `requireMember`/`authErrorResponse` de `src/lib/auth/guards.ts`, `getUploadUrl`/`getDownloadUrl`/`deleteObject` de `src/lib/storage`, `newId` con prefijos `property`/`propertyPhoto`/`clientRequirements`); documentar en el plan si algo cambia

**Checkpoint**: Sin libs nuevas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase (migración del soft-delete,
esquemas Zod compartidos y exposición del scoring para el inverso).

- [X] T002 Añadir columna aditiva `archivedAt: timestamp("archived_at")` y el índice `index("property_org_archived_idx").on(t.organizationId, t.archivedAt)` a la tabla `property` en `src/lib/db/schema/domain.ts` (sin tocar `property_photo` ni `client_requirements`)
- [X] T003 Generar y revisar la migración Drizzle (`pnpm drizzle-kit generate`): el SQL debe ser SOLO `ALTER TABLE property ADD COLUMN archived_at timestamp;` + creación de índice (aditivo, no destructivo). Aplicar local con `pnpm drizzle-kit migrate` y confirmar que el Pre-Deployment Command de Coolify ya corre migraciones (gotcha conocido)
- [X] T004 [P] Crear esquemas Zod compartidos en `src/lib/properties/schemas.ts`: `propertyCreateSchema` (operationType/propertyType enums requeridos; price>0; currency default "MXN"; numéricos opcionales ≥0; status default "disponible"), `propertyUpdateSchema = propertyCreateSchema.partial()`, `statusSchema`, `archiveSchema {archived:boolean}`, `photoSignSchema`/`photoConfirmSchema` (contentType ∈ {image/jpeg,image/png} — **sin webp**, F1; 1000<sizeBytes≤10485760), `requirementsManualSchema` (parcial + refine `budgetMin≤budgetMax`)
- [X] T005 [P] Definir DTOs `PropertyDetail` (todos los campos crudos + `photos: {id,url,sortOrder,isMain}[]`) y `MatchingClient` (`{clientId,name,phone,pct,reasons}`) en `src/lib/inbox/types.ts` (junto a `PropertyView`/`Match`)
- [X] T006 Refactor en `src/server/matching/engine.ts`: exportar `scoreProperty(property, requirements)` (hoy interno) sin cambiar su lógica, para reusarlo en el match inverso; añadir el gate `archivedAt IS NULL` al `where` de `computeMatches` (el matching directo de 004 debe excluir archivadas). **C1**: añadir el mismo gate en `sendPropertyCard` (`src/server/inbox/ficha.ts`) — una propiedad archivada NO se envía como ficha (FR-009); rechazar con `CardSendError` (reason `not_found`/`archived`)

**Checkpoint**: Esquema migrado, validación y scoring listos para todas las historias.

---

## Phase 3: User Story 1 - Crear y editar propiedades reales (Priority: P1) 🎯 MVP

**Goal**: El asesor crea/edita propiedades reales scoped al tenant; `/properties` deja de usar `SAMPLE_PROPERTIES`.

**Independent Test**: Crear una propiedad, recargar y verla listada; editar su precio y confirmar que
persiste; una propiedad de otro tenant responde 404.

- [X] T007 [US1] Crear `src/server/properties/service.ts` con `createProperty(orgId, userId, input)` y `updateProperty(orgId, propertyId, patch)` (insert con `newId("property")`, `createdBy=userId`; update parcial con `updatedAt=now()`; ambos scoped por `organizationId`; devuelven `PropertyDetail`)
- [X] T008 [P] [US1] Crear `src/server/properties/queries.ts` con `listProperties(orgId, {op,status,archived})` → `PropertyView[]` con scope de tenant, default `archived_at IS NULL`, integrando `resolveMainPhotoUrls` para `photoUrl`
- [X] T009 [US1] Crear `src/app/api/properties/route.ts`: `POST` (crear, valida `propertyCreateSchema`, `requireMember`, 201 `{id,property}`, 422 inválido) y `GET` opcional (listar con query, 200 `{properties}`); patrón de `requireMember`+`authErrorResponse`+`force-dynamic` como `ficha/route.ts`
- [X] T010 [US1] Crear `src/app/api/properties/[id]/route.ts`: `GET` (detalle → `PropertyDetail` con fotos prefirmadas, 404 cross-tenant) y `PATCH` (editar parcial, valida `propertyUpdateSchema`, 200 `{property}`)
- [X] T011 [US1] Reemplazar `src/app/(dashboard)/properties/page.tsx` para que sea Server Component que llame a `requireMember()` + `listProperties(orgId, …)` real (eliminar import de `SAMPLE_PROPERTIES`)
- [X] T012 [US1] Crear `src/components/properties/property-form.tsx` (form crear/editar con `react`/shadcn, validación cliente con los Zod de T004, POST/PATCH a los endpoints) y conectar el botón "Nueva propiedad" de `src/components/properties/properties-client.tsx` para abrirlo (hoy es cosmético)

**Checkpoint**: US1 funcional — inventario real con alta/edición, aislado por tenant.

---

## Phase 4: User Story 2 - Marcar estatus y archivar (Priority: P1)

**Goal**: Cambio rápido de estatus y archivar/desarchivar (soft-delete) conservando historial.

**Independent Test**: Cambiar estatus y verlo tras recargar; archivar (sale del inventario activo,
su conversación/visita siguen existiendo); desarchivar (vuelve con su estatus previo); filtro "archivadas".

- [X] T013 [US2] Añadir a `src/server/properties/service.ts`: `setStatus(orgId, propertyId, status)` y `setArchived(orgId, propertyId, archived)` (archivar=`archived_at=now()`, desarchivar=`null`; NO toca `status`); scoped por tenant, 404 si no existe
- [X] T014 [P] [US2] Crear `src/app/api/properties/[id]/status/route.ts`: `PATCH` valida `statusSchema`, `requireMember`, 200 `{status}`
- [X] T015 [P] [US2] Crear `src/app/api/properties/[id]/archive/route.ts`: `POST` valida `archiveSchema`, 200 `{archived,archivedAt}`
- [X] T016 [US2] Añadir el filtro "archivadas" y la acción rápida de estatus + botón archivar/desarchivar en `src/components/properties/properties-client.tsx` (extender `STATUS_FILTERS`/estado de filtro `archived`; las llamadas a status/archive refrescan la lista)

**Checkpoint**: US1 + US2 funcionando; archivar preserva historial y es reversible.

---

## Phase 5: User Story 3 - Detalle completo + galería + CRUD de fotos (Priority: P2)

**Goal**: Desplegar la tarjeta para ver todos los campos + galería; subir/reordenar/principal/eliminar fotos (da fotos reales a la ficha 006).

**Independent Test**: Abrir detalle, subir 2 fotos, marcar una principal, eliminar una; la galería
refleja orden y la principal es `sortOrder=0`; enviar ficha 006 y ver la foto subida.

- [X] T017 [US3] Extender `src/server/properties/photos.ts` con: `listPhotos(orgId, propertyId)` (prefirmadas, ordenadas), `signUpload(orgId, propertyId, {contentType,sizeBytes})` (valida, genera `storageKey=properties/{propertyId}/{newId("propertyPhoto")}.{ext}` + `getUploadUrl`), `confirmPhoto(orgId, propertyId, {photoId,storageKey,contentType,sizeBytes})` (inserta fila con `sortOrder=max+1`), `reorderPhoto(orgId, propertyId, photoId, {action|sortOrder})` y `deletePhoto(orgId, propertyId, photoId)` — ambos **renumeran 0..n-1** en transacción; delete usa `deleteObject` con try/catch no-fatal (como el seed)
- [X] T018 [US3] Crear `src/app/api/properties/[id]/photos/route.ts`: `POST` discriminado por `phase` ("sign"→200 `{photoId,storageKey,uploadUrl}`; "confirm"→201 `{photo}`), validando con `photoSignSchema`/`photoConfirmSchema`, scoped por tenant
- [X] T019 [US3] Crear `src/app/api/properties/[id]/photos/[photoId]/route.ts`: `PATCH` (reorder/make_main → 200 `{photos}`) y `DELETE` (→ 200 `{deleted,photos}`); 404 si la foto no es de esa propiedad/tenant
- [X] T020 [US3] Crear `src/components/properties/property-photos-editor.tsx`: input de archivo → flujo 2 pasos (sign → `PUT uploadUrl` con los bytes → confirm), grilla con reordenar/marcar principal/eliminar, optimista con refetch de `listPhotos`. **U1**: antes de probar, verificar que el bucket R2 tiene la política CORS de `quickstart §1.5` (sin ella el `PUT` directo falla por CORS)
- [X] T021 [US3] Crear `src/app/(dashboard)/properties/property-detail-sheet.tsx` (client): hoja/sheet que abre desde la tarjeta, muestra `PropertyDetail` (todos los campos) + `property-photos-editor` + (placeholder para el panel de match de US4); cablear apertura desde `PropertyCard`/`properties-client.tsx`

**Checkpoint**: US1–US3 funcionando; la ficha 006 usa la foto principal real subida por el usuario.

---

## Phase 6: User Story 4 - Ver clientes que hacen match con una propiedad (Priority: P2)

**Goal**: Match inverso propiedad→clientes reusando el scoring determinista.

**Independent Test**: Con un cliente compatible, abrir el match inverso de una propiedad y verlo con %
y razones; sin compatibles → estado vacío (no error); clientes de otra org nunca aparecen.

- [X] T022 [US4] Añadir `matchClientsForProperty(orgId, propertyId, {topN=20})` en `src/server/matching/queries.ts`: carga la propiedad (404 si archivada/otro tenant → lista vacía/aviso), trae `client_requirements` del tenant (join `client` para name/phone), puntúa con `scoreProperty` (gate operación: requisito `operation` null o == `property.operationType`), descarta `pct=0`, ordena desc, devuelve `MatchingClient[]`
- [X] T023 [US4] Crear `src/app/api/properties/[id]/matching-clients/route.ts`: `GET` `requireMember`, 200 `{propertyId,clients}` (vacío si no hay), 404 cross-tenant
- [X] T024 [US4] Crear `src/components/properties/matching-clients-panel.tsx`: lista de clientes con % y razones (reusa el estilo de razones del panel de matching existente), estado vacío claro; montarlo en `property-detail-sheet.tsx` (reemplaza el placeholder de T021)

**Checkpoint**: US1–US4 funcionando; el match inverso es visible desde el detalle.

---

## Phase 7: User Story 5 - Editar requisitos del cliente manualmente (Priority: P3)

**Goal**: El asesor crea/edita `client_requirements` a mano (`source="manual"`) para alimentar el match inverso.

**Independent Test**: Crear requisitos manuales para un cliente sin requisitos previos; abrir una
propiedad compatible y ver a ese cliente en el match inverso; `budgetMin>budgetMax` → 422.

- [X] T025 [US5] Crear `src/app/api/clients/[id]/requirements/route.ts`: `PUT` valida `requirementsManualSchema` (incluye refine `budgetMin≤budgetMax`), resuelve el cliente con scope de tenant (404 si no es del tenant), delega a `upsertRequirements(orgId, clientId, patch, "manual")`, 200 `{requirements}`
- [X] T026 [US5] **U2**: Crear el editor de requisitos del cliente **dentro del panel de match inverso / sheet** (botón "Editar requisitos" por cliente que abre el form en un popover/modal) — NO crear página nueva de detalle de cliente; hace `PUT` al endpoint y refresca el match; reusar los Zod de T004

**Checkpoint**: US1–US5 completas; el asesor controla los requisitos y el match inverso responde.

---

## Phase 8: Polish & Cross-Cutting (verificación reforzada)

- [X] T027 Gate técnico: `pnpm typecheck && pnpm lint && pnpm build` en verde
- [X] T028 Self-test E2E camino feliz (quickstart §3): crear→editar→fotos(principal/eliminar)→estatus→archivar/desarchivar→match inverso→requisitos manuales→ficha 006 con foto real, conducido por mí (no delegado)
- [X] T029 Self-test camino infeliz (quickstart §4): input inválido (422), cross-tenant (404), foto inválida (422), propiedad sin foto (degrada), cero matches (vacío), propiedad archivada excluida del matching directo, eliminar principal renumera
- [X] T030 [P] Verificación de aislamiento con dos tenants (quickstart §5): listado/detalle/PATCH/status/archive/photos/matching-clients con id ajeno → 404 en todos
- [X] T031 [P] Marcar como "pendiente de verificación humana" el juicio visual del detalle/galería/formulario; actualizar `tasks.md` (hecho/pendiente) y memoria con gotchas encontrados

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: depende de Fase 1; **bloquea todas las historias** (migración + Zod + scoring exportado).
- **US1 (Fase 3)**: depende de Fase 2. MVP.
- **US2 (Fase 4)**: depende de Fase 2; toca el service/UI de US1 (extiende `service.ts` y `properties-client.tsx`) → mejor tras US1.
- **US3 (Fase 5)**: depende de Fase 2; el sheet (T021) consume el detalle de US1 (T010) → tras US1.
- **US4 (Fase 6)**: depende de Fase 2 (scoring T006); su panel se monta en el sheet de US3 (T021) → tras US3 para la UI, pero el endpoint (T022–T023) es independiente.
- **US5 (Fase 7)**: depende de Fase 2; habilita datos para US4 pero es independientemente testeable.
- **Polish (Fase 8)**: depende de las historias deseadas completas.

### Within Each User Story

- service/queries (servidor) antes que endpoints; endpoints antes que UI que los consume.
- US1: T007 antes de T009/T010; T008 antes de T011.
- US3: T017 antes de T018/T019; editor (T020) antes del sheet (T021).
- US4: T022 antes de T023 antes de T024.

### Parallel Opportunities

- T004 y T005 en paralelo (archivos distintos) dentro de Fase 2.
- T014 y T015 en paralelo (endpoints distintos) en US2.
- En US3, T018 y T019 tras T017 pueden avanzar en paralelo si se respeta el contrato de `photos.ts`.
- T030 y T031 en paralelo en Polish.

---

## Implementation Strategy

### MVP First (US1)

1. Fase 1 Setup → 2. Fase 2 Foundational (CRÍTICA, migración) → 3. Fase 3 US1 → **validar**: inventario
real con alta/edición aislado por tenant. Desplegar/demostrar.

### Incremental Delivery

US1 (inventario real) → US2 (estatus+archivar) → US3 (detalle+fotos, desbloquea fotos reales para 006)
→ US4 (match inverso) → US5 (requisitos manuales, mejora la calidad del match inverso). Cada historia
agrega valor sin romper las previas; tras cada checkpoint, self-test de esa rebanada.

---

## Notes

- [P] = archivos distintos, sin dependencias incompletas.
- Todo `select/insert/update/delete` lleva `eq(table.organizationId, orgId)` con `orgId` de `requireMember()`.
- La subida de fotos nunca pasa bytes por el server (PUT prefirmado); el server solo firma (Principio I/II).
- Principal = menor `sortOrder` (convención existente que ya consume la ficha 006); reorder/delete renumeran.
- "Hecho" = T027 + T028 + T029 verdes, conducidos por mí; lo visual se marca pendiente humano.
- Commit por tarea o grupo lógico; merge a `main` requiere OK explícito del dueño.
