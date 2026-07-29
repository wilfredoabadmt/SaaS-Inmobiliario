---
description: "Task list — CRM Inmobiliario con WhatsApp"
---

# Tasks: CRM Inmobiliario con WhatsApp

**Input**: Design documents from `specs/001-realestate-whatsapp-crm/`
**Prerequisites**: plan.md, spec.md (16/16), data-model.md, contracts/, research.md,
design-tokens.md

**Organización**: por historia de usuario (P1 → P2 → P3 → P4) para entrega incremental.
**Regla de recorte**: P4 va al final; si el tiempo se acaba, P1–P3 quedan completas.

## Formato: `[ID] [P?] [Story?] Descripción + ruta`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencias pendientes).
- **[USx]**: historia a la que pertenece (solo fases de historia).

## Definición de "Hecho" (Principio V)

Toda tarea de feature está "Hecha" solo si pasan **`pnpm typecheck` + `pnpm lint` +
`pnpm build`** y la **prueba manual** indicada en la tarea (`✓ Hecho:`). Lo no
verificable automáticamente se marca "pendiente de verificación humana".

---

## Phase 1: Setup (infraestructura compartida)

- [X] T001 Crear proyecto Next.js 15 (App Router) con TypeScript estricto (`strict` +
  `noUncheckedIndexedAccess`) y pnpm; estructura `src/` por plan.md.
- [X] T002 [P] Configurar Tailwind + shadcn/ui (modo claro) y mapear los tokens de
  `design-tokens.md` al theme (fuente **Geist**; vars teal `--accent #0d9488…`; paleta
  ámbar renta `#d99a08/#9a5b00/#fff8ed…`; radios `7/10/14px`; `--row-py 11px`) en
  `tailwind.config.ts` y `src/app/globals.css`.
- [X] T003 [P] Configurar ESLint y scripts en `package.json`: `typecheck` (tsc
  --noEmit), `lint`, `build`, `db:migrate`, `test`, `test:e2e`.
- [X] T004 [P] Validación de variables de entorno con Zod en `src/lib/env.ts`
  (`DATABASE_URL`, `ENCRYPTION_KEY`, `META_*` x7, `S3_*`) — falla al arranque si falta alguna.
- [X] T005 Configurar Drizzle ORM + drizzle-kit y cliente de DB en `src/lib/db/index.ts`
  (conexión por `DATABASE_URL`); `drizzle.config.ts`.
- [X] T006 `Dockerfile` multi-stage (Next `standalone`) + healthcheck
  `GET /api/health` en `src/app/api/health/route.ts` (verifica `SELECT 1`).

**Checkpoint**: el proyecto compila, levanta y `/api/health` responde `200`.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**⚠️ Ninguna historia puede empezar hasta completar esta fase.**

- [X] T007 Helper de IDs nanoid con prefijo en `src/lib/db/ids.ts` (`org_`, `prop_`,
  `photo_`, `cli_`, `cand_`, `conv_`, `cp_`, `msg_`, `tmpl_`, `show_`, `doc_`, `ctr_`,
  `wamc_`).
- [X] T008 Configurar Better Auth (self-hosted) + plugin `organization` (roles
  owner/agent) en `src/lib/auth/`; handler en `src/app/api/auth/[...all]/route.ts`. (dep: T005)
- [X] T009 **Guard base de autorización**: helper de sesión + organización activa y
  `requireRole('owner')` / `requireMember()` en `src/lib/auth/guards.ts`. Es el
  enforcement mínimo owner-only que necesitan el onboarding de WhatsApp (US1) y la
  gestión de equipo (US3); se reutiliza en todas las fases. (dep: T008)
- [X] T010 Schema Drizzle de Better Auth (user/session/account/verification) +
  organization/member/invitation en `src/lib/db/schema/auth.ts`. (dep: T007, T008)
- [X] T011 Schema Drizzle de **todas** las tablas de dominio con `organization_id`
  indexado, enums y constraints (incluye `message.wa_message_id` **UNIQUE** y único
  parcial `conversation_property(conversation_id) WHERE is_primary`) en
  `src/lib/db/schema/domain.ts`, por data-model.md. (dep: T007, T010)
- [X] T012 Generar y versionar la migración inicial con drizzle-kit en `drizzle/`. (dep: T011)
- [X] T013 Helper de scope de tenant `withTenant(orgId)` que inyecta el filtro
  `organization_id` en `src/lib/db/tenant.ts`; ninguna query de dominio sin scope. (dep: T011)
- [X] T014 [P] Helpers AES-256-GCM (`encrypt`/`decrypt`, IV + auth tag) en
  `src/lib/crypto/index.ts`. (dep: T004)
- [X] T015 [P] Wrapper de almacenamiento S3 (`putObject`, `getSignedUrl`,
  `deleteObject`) en `src/lib/storage/index.ts` usando `S3_*`. (dep: T004)
- [X] T016 [P] Cliente tipado de WhatsApp Cloud API (solo transporte + tipos) en
  `src/lib/meta/`. (dep: T004)
- [X] T017 [P] Abstracción de tiempo real (DV-1): hook `useRealtimeMessages` + módulo
  `src/lib/realtime/` con implementación de **polling** (frontera agnóstica,
  websocket-ready). (dep: T001)
- [X] T018 Shell autenticado del dashboard (layout, navegación, rutas protegidas) y
  primitivos shadcn base en `src/app/(dashboard)/layout.tsx`, replicando densidad y
  layout de `docs/design/`. (dep: T002, T008, T009)
- [X] T019 [P] Setup de Vitest y tests de invariantes: round-trip de `crypto` y
  aislamiento de `withTenant` en `tests/foundational/`. (dep: T013, T014)

**Checkpoint**: fundación lista (incluido el guard owner-only) — pueden comenzar las historias.

---

## Phase 3: User Story 1 — Comunicación (P1) 🎯 MVP

**Goal**: conectar WhatsApp sin código y operar una bandeja única con plantillas.
**Independent Test**: conectar un número de prueba, recibir un mensaje externo en la
bandeja, responder y enviar una plantilla — sin abrir WhatsApp.

- [X] T020 [US1] Servicio de credenciales Meta: cifrar y guardar token + estado de
  conexión en `meta_credentials` vía `src/server/whatsapp/credentials.ts`. (dep: T013, T014, T016)
- [X] T021 [US1] Onboarding Embedded Signup (**solo owner**): `POST /api/whatsapp/connect`
  (intercambia código server-side, cifra token, upsert) + `GET /api/whatsapp/connection`
  en `src/app/api/whatsapp/`, protegido con el guard de T009. — ✓ Hecho:
  typecheck+lint+build; conectar deja estado `connected`, **nunca** devuelve el token y
  un agente recibe 403 (FR-001/FR-006/FR-008). (dep: T009, T020)
- [X] T022 [US1] UI de onboarding en `src/app/(dashboard)/settings/whatsapp/` (botón
  Embedded Signup + estado), visible solo a owner. — ✓ Hecho: typecheck+lint+build; el
  dueño conecta el número desde la UI sin tocar config técnica (FR-001). (dep: T009, T021)
- [X] T023 [US1] Webhook en `src/app/api/webhooks/whatsapp/route.ts`: `GET` verify
  (challenge) + `POST` con verificación `X-Hub-Signature-256` **antes** de procesar y
  resolución de org por `phone_number_id`. — ✓ Hecho: typecheck+lint+build; firma
  inválida → 401 sin efectos (FR-005, Principio I/IV). (dep: T011, T016, T020)
- [X] T024 [US1] Procesar inbound: dedup por `wa_message_id` (`ON CONFLICT DO
  NOTHING`), crear `client`/`conversation` si faltan, insertar `message`, actualizar
  `last_message_at` en `src/server/inbox/ingest.ts`. — ✓ Hecho: typecheck+lint+build;
  reenviar el mismo evento no duplica el mensaje (FR-005/SC-003). (dep: T023)
- [X] T025 [US1] Vitest: idempotencia del webhook + verificación de firma en
  `tests/inbox/webhook.test.ts`. (dep: T024)
- [X] T026 [US1] API `GET /api/conversations` (scope de tenant, orden por
  `last_message_at`, incluye propiedad principal) en `src/app/api/conversations/`. —
  ✓ Hecho: typecheck+lint+build; lista solo conversaciones de la agencia (FR-002/FR-007). (dep: T013, T024)
- [X] T027 [US1] API `GET /api/conversations/:id/messages` + `POST` enviar texto (vía
  `lib/meta`, persistir outbound). — ✓ Hecho: typecheck+lint+build; el cliente recibe
  la respuesta por WhatsApp (FR-003). (dep: T026)
- [X] T028 [US1] Plantillas: `GET/POST /api/templates` + `POST
  /api/conversations/:id/messages/template`. — ✓ Hecho: typecheck+lint+build; enviar
  una plantilla aprobada llega formateada (FR-004). (dep: T011, T027)
- [X] T029 [US1] UI bandeja — **layout de 3 columnas** (lista · hilo · panel lateral)
  replicando `docs/design/Bandeja WhatsApp (offline).html`; consume la abstracción de
  tiempo real (T017) en `src/app/(dashboard)/inbox/`. — ✓ Hecho: typecheck+lint+build;
  un mensaje entrante aparece en < 2 s y se responde desde la bandeja (FR-002/FR-003/SC-002). (dep: T017, T018, T027)
- [X] T030 [US1] Composer: enviar plantilla desde el hilo. — ✓ Hecho:
  typecheck+lint+build; seleccionar plantilla y enviarla desde la conversación (FR-004). (dep: T028, T029)

**Checkpoint**: P1 funcional y verificable de forma independiente (MVP).

---

## Phase 4: User Story 2 — Dominio inmobiliario (P2)

**Goal**: catálogo de propiedades, vínculo conversación↔propiedad y candidaturas.
**Independent Test**: crear propiedad, vincular una conversación a ella y registrar al
cliente como candidato.

- [ ] T031 [US2] Servicio + API CRUD de propiedades `GET/POST/GET:id/PATCH/DELETE
  /api/properties` con validación Zod de todos los campos (operación, tipo, precio+
  moneda, ubicación, recámaras, baños, m², estacionamientos, estatus, descripción) en
  `src/app/api/properties/`. — ✓ Hecho: typecheck+lint+build; alta/edición/listado
  por agencia (FR-010/011/012). (dep: T013)
- [ ] T032 [US2] Fotos de propiedad: `presign` (valida ≤20, ≤10 MB, jpeg/png/webp) +
  confirm + delete en `src/app/api/properties/[id]/photos/`. — ✓ Hecho:
  typecheck+lint+build; subir foto válida y rechazar tipo/tamaño inválido (FR-013). (dep: T015, T031)
- [ ] T033 [US2] UI catálogo — **grid de tarjetas** replicando
  `docs/design/Propiedades (offline).html` (acento **ámbar=renta**, **teal=venta**) +
  formulario de propiedad en `src/app/(dashboard)/properties/`. — ✓ Hecho:
  typecheck+lint+build; crear y ver propiedad con su acento por operación (FR-010). (dep: T018, T031, T032)
- [ ] T034 [US2] API vínculo conversación↔propiedad `POST/DELETE
  /api/conversations/:id/properties` (M:N, marca principal con único parcial). — ✓
  Hecho: typecheck+lint+build; asociar varias propiedades y fijar una principal (FR-014). (dep: T011, T026)
- [ ] T035 [US2] Panel lateral de la bandeja: asociar propiedad + mostrar principal
  (replica el panel de `docs/design/Bandeja WhatsApp (offline).html`). — ✓ Hecho:
  typecheck+lint+build; vincular desde la conversación y ver el inmueble (FR-014). (dep: T029, T034)
- [ ] T036 [US2] Servicio + API de clientes (autocreado en inbound; edición manual) en
  `src/app/api/clients/`. — ✓ Hecho: typecheck+lint+build; un cliente puede tener
  varias conversaciones (DV-4) (FR-007). (dep: T024)
- [ ] T037 [US2] API de candidaturas: crear (único client+property), listar (filtro de
  pipeline), `PATCH` etapa (8 estados; `documentacion` manual) en
  `src/app/api/candidacies/`. — ✓ Hecho: typecheck+lint+build; registrar candidatura y
  cambiar etapa (FR-015, DV-5). (dep: T031, T036)
- [ ] T038 [US2] UI candidatura en el panel lateral: registrar candidato + pipeline de
  8 estados. — ✓ Hecho: typecheck+lint+build; crear candidato y avanzar etapa < 1 min
  (FR-015/SC-005). (dep: T035, T037)

**Checkpoint**: P1 + P2 funcionan de forma independiente.

---

## Phase 5: User Story 3 — Operación comercial (P3)

**Goal**: muestras con recordatorio por WhatsApp y gestión de equipo con roles.
**Independent Test**: invitar un agente, agendar una muestra y recibir el recordatorio.

- [ ] T039 [US3] API de equipo: invitaciones + miembros + remover (solo owner, guard
  T009) vía plugin `organization` en `src/app/api/team/`. — ✓ Hecho:
  typecheck+lint+build; el dueño invita a un agente y este accede (FR-009). (dep: T009, T010)
- [ ] T040 [US3] UI de equipo en `src/app/(dashboard)/team/` (solo owner). — ✓ Hecho:
  typecheck+lint+build; gestionar miembros y roles desde la UI (FR-009). (dep: T039)
- [ ] T041 [US3] Servicio + API CRUD de muestras `/api/showings` (`scheduledAt`,
  `remindAt` default 24 h/1 h, `status`) en `src/app/api/showings/`. — ✓ Hecho:
  typecheck+lint+build; agendar muestra asociada a propiedad (FR-016). (dep: T011, T031)
- [ ] T042 [US3] UI de agenda de muestras + agendar desde propiedad/candidatura en
  `src/app/(dashboard)/showings/`. — ✓ Hecho: typecheck+lint+build; agendar y ver la
  muestra en la agenda (FR-016). (dep: T033, T038, T041)
- [ ] T043 [US3] Job programado: barrer muestras vencidas (`status=agendada`,
  `now()≥remind_at`) y **enviar recordatorio por WhatsApp con plantilla aprobada** al
  agente responsable en `src/server/showings/reminders.ts` (DV-2). — ✓ Hecho:
  typecheck+lint+build; el agente recibe el recordatorio antes de la cita (FR-017/SC-006). (dep: T016, T028, T041)
- [ ] T044 [US3] Enforcement **ampliado** de roles: aplicar el guard base (T009) al
  resto de acciones owner-only de US3 (gestión de equipo) en API y UI, y cubrir casos
  no contemplados en fundación, en `src/lib/auth/guards.ts` (extensión). — ✓ Hecho:
  typecheck+lint+build; un agente no puede gestionar el equipo (FR-008). (dep: T009, T039)

**Checkpoint**: P1 + P2 + P3 completas y sólidas.

---

## Phase 6: User Story 4 — Documentos y contratos (P4) — ÚLTIMO

**Goal**: expediente documental del candidato y seguimiento de contratos subidos.
**Independent Test**: subir documentos del cliente, subir un contrato y mover su estado.
**Nota de recorte**: esta fase es la primera en sacrificarse; P1–P3 deben estar completas antes.

- [ ] T045 [US4] Documentos de cliente: `presign` + confirm + listar (anclados al
  `client`, expediente reutilizable) en `src/app/api/clients/[id]/documents/`. — ✓
  Hecho: typecheck+lint+build; subir identificación/comprobante (FR-019). (dep: T015, T036)
- [ ] T046 [US4] UI de expediente: subir, listar y descargar (URL prefirmada) en el
  detalle del candidato. — ✓ Hecho: typecheck+lint+build; ver el expediente del
  candidato (FR-019). (dep: T038, T045)
- [ ] T047 [US4] Contratos: `presign` + confirm (anclado a candidatura) + `PATCH`
  estado (borrador→enviado→en_negociación→firmado) en `src/app/api/contracts/` y
  `.../candidacies/[id]/contracts/`. — ✓ Hecho: typecheck+lint+build; subir contrato y
  cambiar estado; **no** existe generación (FR-020/021/022). (dep: T015, T037)
- [ ] T048 [US4] UI de contratos: subir + tracker de estado (sin generación) en el
  detalle de la operación. — ✓ Hecho: typecheck+lint+build; el estado mostrado refleja
  el último valor (FR-021/SC-007). (dep: T038, T047)

**Checkpoint**: las 4 historias funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T049 [P] Logging con **redacción de secretos** (nunca registrar tokens) en
  `src/lib/logger.ts` (Principio I). — ✓ Hecho: typecheck+lint+build; inspección de
  logs no muestra credenciales (SC-008).
- [ ] T050 [P] Test de integración de aislamiento de tenant sobre los endpoints de
  dominio en `tests/integration/tenant-isolation.test.ts` (SC-004).
- [ ] T051 [P] Manejo de edge cases (indicador de conexión caída, borrar propiedad con
  asociaciones, muestra vencida sin marcar, archivo no soportado) según spec §Edge Cases.
- [ ] T052 Config de despliegue en Coolify: Pre-Deployment Command `pnpm db:migrate`,
  healthcheck `/api/health`, variables de entorno (sin valores) por quickstart.md.
- [ ] T053 Ejecutar el smoke test de quickstart.md por historia (P1→P4) y registrar lo
  pendiente de verificación humana.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: sin dependencias.
- **Foundational (P2)**: depende de Setup. Incluye el **guard owner-only (T009)**.
  **Bloquea todas las historias.**
- **US1 (P1)**: depende de Foundational. Es el MVP.
- **US2 (P2)**: depende de Foundational; integra con US1 (bandeja) para T034/T035.
- **US3 (P3)**: depende de Foundational; T042 integra con US2 (propiedad/candidatura).
- **US4 (P4)**: depende de Foundational; integra con US2 (candidatura). **Va al final.**
- **Polish (P7)**: depende de las historias entregadas.

> Todas las dependencias apuntan **hacia atrás** (a fases anteriores o a tareas previas
> de la misma fase). No hay referencias hacia fases posteriores.

### Orden recomendado

```text
Setup → Foundational → US1 (MVP) → US2 → US3 → US4 → Polish
```

## Parallel Opportunities

- Setup: T002, T003, T004 en paralelo.
- Foundational: T014, T015, T016, T017, T019 en paralelo (tras T011/T013); T009 tras T008.
- US1: T025 (tests) en paralelo con UI tras T024; T026–T028 (API) antes de T029–T030 (UI).
- US2: T031 y T036 pueden avanzar en paralelo; T032 tras T031.
- US3: T039/T040 (equipo) en paralelo con T041–T043 (muestras).
- Polish: T049, T050, T051 en paralelo.

## Implementation Strategy

### MVP primero (solo US1)

1. Completar Setup + Foundational.
2. Completar US1 (comunicación) → validar bandeja end-to-end → desplegar/demo (MVP).

### Entrega incremental

US1 → US2 → US3 → US4, validando cada historia de forma independiente antes de la
siguiente. Si el tiempo se agota, **detenerse tras US3 con P1–P3 completas** y diferir
US4 (P4).

## Notas

- Frontend: replicar fielmente `docs/design/` (tokens en design-tokens.md); **no**
  mergear el HTML.
- Toda mutación valida pertenencia al mismo `organization_id` (Principio III).
- "Hecho" = typecheck + lint + build + prueba manual de la tarea; lo no verificable se
  marca pendiente de verificación humana (Principio V).
