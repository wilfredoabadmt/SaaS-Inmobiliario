# Tasks: Agendamiento de visitas con calendario real (011-visit-scheduling)

**Plan**: [plan.md](plan.md) · **Spec**: [spec.md](spec.md) · **Data model**: [data-model.md](data-model.md)
· **Contracts**: [contracts/api.md](contracts/api.md) · **Research**: [research.md](research.md)

Convención: `- [ ] [TaskID] [P?] [Story?] Descripción con ruta`. `[P]` = paralelizable (archivos distintos,
sin dependencia pendiente). Stack: Next.js 15 App Router · Drizzle/Postgres · Better Auth · Zod · TS estricto.

---

## Phase 1: Setup

- [ ] T001 Instalar dependencias nuevas: `pnpm add nodemailer luxon` y `pnpm add -D @types/nodemailer @types/luxon` (verificar que entran a `package.json`).
- [ ] T002 [P] Añadir env vars nuevas en `src/lib/env.ts` (`GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `SMTP_HOST/PORT/USER/PASS/FROM`, `MAIL_FROM_NAME`) como opcionales `.default("")`, con sus placeholders de build; añadir helpers `isGoogleCalendarConfigured(env)` e `isEmailConfigured(env)` (patrón `isInstagramConfigured`).
- [ ] T003 [P] Añadir prefijos de ID `calendarSettings: "calset"` y `googleCalendarCredentials: "gcal"` en `src/lib/db/ids.ts`.
- [ ] T004 [P] Documentar en `.env` local (no commitear secretos) las nuevas variables con valores de la cuenta de prueba para el self-test.

---

## Phase 2: Foundational (bloquea todas las user stories)

- [ ] T005 Definir esquema Drizzle en `src/lib/db/schema/domain.ts`: enum `googleCalendarStatus` (`connected|reconnect_required|disconnected`); tabla `calendarSettings` (org+user, `weeklyHours` jsonb, `slotMinutes`, `bufferMinutes`, `timezone`, unique `(organization_id,user_id)`); tabla `googleCalendarCredentials` (org+user, `googleSub`, `email`, `calendarId` default `primary`, access+refresh cifrados, `accessTokenExpiresAt`, `scope`, `status`, unique `(organization_id,user_id)`); columnas aditivas en `showing`: `durationMinutes` (int), `googleEventId` (text), `reminderEmailSentAt` (timestamp). Ver data-model.md.
- [ ] T006 Escribir a mano `drizzle/0009_visit_scheduling.sql` (CREATE TYPE enum + 2 CREATE TABLE con índices únicos + 3 ALTER TABLE ADD COLUMN en `showing`), añadir entrada en `drizzle/meta/_journal.json` y reconciliar `drizzle/meta/0009_snapshot.json` (flujo manual del repo; ver [[gotcha-drizzle-data-migration]]). Correr `pnpm db:migrate` local contra la BD de pruebas y verificar las 2 tablas + 3 columnas.
- [ ] T007 [P] Crear helper de tiempo `src/lib/time/slots.ts` con luxon: `expandWorkingDayToUtc(dateISO, intervals, tz, slotMinutes, bufferMinutes) → {startUtc,endUtc}[]`, `overlaps(aStart,aEnd,bStart,bEnd)`, `labelInTz(startUtc, tz)`. Sin acceso a BD (puro).
- [ ] T008 [P] Crear tipos compartidos de calendario en `src/server/calendar/types.ts`: `WeeklyHours`, `Interval`, `AvailabilitySlot`, `CalendarSettingsView` (alineados a data-model.md).

---

## Phase 3: User Story 1 — Configurar horas hábiles y disponibilidad (P1) 🎯 MVP

**Goal**: el asesor define horas hábiles/slot/buffer/tz por usuario y el sistema calcula slots libres
(degradado a horas hábiles − visitas Inmox, sin Google todavía).

**Independent test**: guardar settings en `/showings`, recargar persiste; `GET /api/calendar/availability`
devuelve slots correctos excluyendo visitas existentes; aislamiento por usuario/tenant.

- [ ] T009 [P] [US1] `src/server/calendar/settings.ts`: `getSettings(orgId,userId)` (default virtual si no hay fila, DV-VS-14) y `upsertSettings(orgId,userId,input)` con validación de dominio (start<end, sin solapes, rangos de slot/buffer, tz IANA).
- [ ] T010 [US1] `src/server/calendar/availability.ts`: `computeAvailability(orgId, agentId, fromISO, toISO)` = expandir `weeklyHours` (lib/time) − solape con `showing` activos del asesor (`status='agendada'`, `scheduledAt`+`durationMinutes`) − pasados. (Resta de Google se añade en US4 vía hook opcional; aquí degrada a local.) Devuelve `AvailabilitySlot[]` + `timezone` + `googleConnected:false`.
- [ ] T011 [P] [US1] Endpoint `src/app/api/calendar/settings/route.ts`: `GET` (settings del usuario actual) y `PUT` (upsert, Zod, 400 `invalid_settings`). `requireMember()`.
- [ ] T012 [P] [US1] Endpoint `src/app/api/calendar/availability/route.ts`: `GET ?from&to&agentId?` (default usuario actual; valida `agentId` miembro de la org; ventana máx ~14 días). `requireMember()`.
- [ ] T013 [US1] UI de settings en `/showings`: componente client (form de horas hábiles por día con intervalos, slot, buffer, selector de timezone) que consume `GET/PUT /api/calendar/settings`; integrarlo en `src/app/(dashboard)/showings/page.tsx` sin romper la lista existente.
- [ ] T014 [US1] Verificación US1: typecheck/lint; guardar/recargar persiste; availability excluye una visita sembrada; un segundo usuario no ve la config del primero.

**Checkpoint**: disponibilidad real por asesor funcionando sin Google ni agente.

---

## Phase 4: User Story 2 — El agente IA propone slots y agenda (P1)

**Goal**: el agente ofrece 2-3 slots concretos y agenda/reprograma/cancela; reusa `createShowingFromAgent`.

**Independent test**: WhatsApp real → pedir visita → agente propone slots válidos → elegir → visita en
/showings + pipeline avanza al ancla `visit`; reprogramar/cancelar por chat funcionan.

- [ ] T015 [US2] Extender `src/server/showings/service.ts`: en `createShowingFromAgent` capturar `durationMinutes` de settings del asesor, **re-validar disponibilidad** del slot antes de insertar (DV-VS-4) y persistir `durationMinutes`; añadir `rescheduleShowing(orgId, showingId, whenISO)` y `cancelShowing(orgId, showingId)` (validan pertenencia al tenant + slot disponible en reschedule). (Sync Google + email se enganchan en US4/US3.)
- [ ] T016 [P] [US2] `src/server/showings/queries.ts`: `listActiveShowingsForClient(orgId, clientId) → {showingId, propertyTitle, label, startUtc}[]` (status `agendada`, futuras) para inyectar al contexto del agente.
- [ ] T017 [US2] Extender `src/server/ai/prompts.ts`: ampliar el JSON de `action` (`reschedule_visit|cancel_visit`, campo `showingId`) y añadir al `buildContextBlock` los bloques "Slots disponibles del asesor (usa startUtc como whenISO)" y "Visitas activas del cliente (usa showingId)". Instrucción: proponer 2-3 slots concretos, no inventar horarios.
- [ ] T018 [US2] Extender `src/server/ai/agent.ts`: `ACTION_TYPES` += `reschedule_visit, cancel_visit`; `normalizeAction` extrae `showingId`; calcular disponibilidad del asesor de la conversación (reusa `availability.ts`) + visitas activas y pasarlos a `buildContextBlock`; validar y ejecutar acciones (anti-alucinación: `whenISO ∈ slots ofrecidos`, `showingId ∈ visitas activas del cliente`); degradar sin tumbar el turno.
- [ ] T019 [P] [US2] Endpoints UI manual: `src/app/api/showings/[id]/reschedule/route.ts` (POST `{whenISO}`, 409 `slot_taken`), `src/app/api/showings/[id]/cancel/route.ts` (POST), `src/app/api/showings/[id]/status/route.ts` (PATCH `realizada|no_show`, opcional). `requireMember()`.
- [ ] T020 [US2] Verificación US2 (gate técnico): typecheck/lint/build; prueba con datos sembrados de que `schedule_visit` con `whenISO` fuera de slots NO agenda y con slot válido SÍ; reschedule/cancel mutan correctamente. (Live E2E en Phase 7.)

**Checkpoint**: el agente agenda sobre disponibilidad real (degradado, sin Google/email).

---

## Phase 5: User Story 3 — Notificaciones por email al asesor (P2)

**Goal**: email de confirmación al agendar/reprogramar/cancelar + recordatorio 1 h antes (idempotente).

**Independent test**: agendar → llega email al asesor; forzar ventana → un recordatorio; segunda corrida no
reenvía.

- [ ] T021 [P] [US3] Frontera `src/lib/mail/index.ts`: transport nodemailer (SMTP env), `sendMail({to,subject,html,text})` **best-effort** (try/catch, no lanza, loguea sin secretos); no-op si `isEmailConfigured` es false.
- [ ] T022 [P] [US3] `src/lib/mail/templates.ts`: render de asunto+cuerpo para `confirmation|reschedule|cancellation|reminder` (cliente, propiedad, fecha/hora en tz del asesor, link `/inbox?c=` a la conversación).
- [ ] T023 [US3] `src/server/calendar/notify.ts`: `notifyShowing(kind, showingId)` que resuelve `user.email`/nombre por `agent_id`, datos de cliente/propiedad y dispara `sendMail`. Enganchar en `createShowingFromAgent`/`rescheduleShowing`/`cancelShowing` (best-effort, no rompe el agendado).
- [ ] T024 [US3] `src/server/calendar/reminders.ts`: `sendDueReminders()` selecciona `showing` `status='agendada'`, `reminderEmailSentAt IS NULL`, `scheduledAt > now()`, `scheduledAt <= now()+65min`; envía recordatorio y setea `reminderEmailSentAt` (idempotente, best-effort por fila). Devuelve `{sent,scanned}`.
- [ ] T025 [US3] Endpoint cron `src/app/api/cron/visit-reminders/route.ts`: `POST` protegido por `CRON_SECRET` (header/query, patrón instagram-refresh) → `sendDueReminders()`.
- [ ] T026 [US3] Verificación US3: typecheck/lint; con SMTP de prueba, agendar dispara confirmación; invocar el cron envía un recordatorio y la 2ª invocación no reenvía (idempotencia).

**Checkpoint**: el asesor recibe correos; recordatorio idempotente.

---

## Phase 6: User Story 4 — Google Calendar bidireccional por usuario (P2)

**Goal**: conectar/desconectar Google; freeBusy bloquea disponibilidad; crear/mover/borrar evento al
agendar/reprogramar/cancelar; token inválido → reconnect + degradación.

**Independent test**: conectar Google de la cuenta de prueba; evento ocupado bloquea un slot; agendar crea
evento; reprogramar lo mueve; cancelar lo borra; token revocado degrada.

- [ ] T027 [P] [US4] Frontera `src/lib/google/state.ts`: `signState(orgId,userId,ttl)`/`verifyState(state)` (HMAC con `BETTER_AUTH_SECRET`, payload `org.user.nonce.exp`, patrón instagram/oauth).
- [ ] T028 [P] [US4] Frontera `src/lib/google/index.ts` (fetch): `buildAuthorizeUrl(state)` (`access_type=offline`, `prompt=consent`, scopes calendar.events+calendar.readonly), `exchangeCode(code)`, `refreshAccessToken(refresh)`, `queryFreeBusy(token,calendarId,fromISO,toISO)`, `insertEvent/patchEvent/deleteEvent(token,calendarId,...)`. Errores `invalid_grant`/401 tipados para mapear a reconnect.
- [ ] T029 [US4] `src/server/calendar/google.ts`: `saveCredentials`/`getCredentials`(refresh on-demand + re-seal)/`getStatusView`(sin token)/`disconnect`/`markReconnectRequired`, cifrando access y refresh por separado (`seal/open`, DV-VS-7).
- [ ] T030 [US4] Enganchar freeBusy en `src/server/calendar/availability.ts`: si el asesor está `connected`, restar periodos `busy` de `queryFreeBusy`; si falla/`reconnect_required`, degradar a local y marcar estado (DV-VS-13). Exponer `googleConnected` en el resultado.
- [ ] T031 [US4] Enganchar escritura de evento en `service.ts`: al crear → `insertEvent` y guardar `showing.google_event_id` (si ya hay id, `patchEvent`); reschedule → `patchEvent` (start/end); cancel → `deleteEvent`. Todo best-effort para Inmox: fallo → `markReconnectRequired` + continuar (DV-VS-11).
- [ ] T032 [P] [US4] Endpoints OAuth: `src/app/api/calendar/google/connect/route.ts` (302 authorize, 501 si no configurado), `callback/route.ts` (verifica state, intercambia, guarda, redirige `/showings?google=...`), `status/route.ts` (GET), `disconnect/route.ts` (POST). `requireMember()` donde aplica.
- [ ] T033 [US4] UI de conexión Google en `/showings`: botón conectar/desconectar + estado (conectado/reconectar/desconectado) leyendo `GET /api/calendar/google/status`; manejar `?google=connected|error` en el callback.
- [ ] T034 [US4] Verificación US4 (gate técnico): typecheck/lint/build; con un token mock, availability excluye busy; crear/mover/borrar llama al endpoint correcto; token inválido marca `reconnect_required` sin romper el agendado.

**Checkpoint**: calendario bidireccional completo; el agente ya ve ocupado real de Google.

---

## Phase 7: Polish & Self-test E2E en vivo (Definición de Hecho REFORZADA)

- [ ] T035 Gate técnico completo: `pnpm typecheck && pnpm lint && pnpm build` en verde.
- [ ] T036 Provisión de credenciales (dueño): app de Google Cloud (Client ID/Secret + test user) y Gmail App Password; cargar `GOOGLE_*` y `SMTP_*` en Coolify (runtime, `is_buildtime=false`). Crear scheduled task `*/5` para `/api/cron/visit-reminders`. Ver quickstart.md §3-6.
- [ ] T037 Desplegar a inmox-dev (agente coolify-deploy-ops): aplicar migración `0009` por Pre-Deployment Command; confirmar healthcheck y que el build está vivo.
- [ ] T038 Self-test E2E camino feliz (skill `whatsapp-ai-agent-selftest`): configurar horas → conectar Google → evento ocupado → WhatsApp real: agente propone slots (excluyen el ocupado) → agendar → verificar visita en /showings + evento en Google + email de confirmación; reprogramar (mueve evento+email) y cancelar (borra evento+email); forzar recordatorio 1 h. Ver quickstart.md §7.
- [ ] T039 Self-test E2E camino infeliz: Google desconectado degrada; slot ocupado no se ofrece; token revocado→reconnect sin colgarse; SMTP caído no tumba agendado; no-JSON del LLM degrada; aislamiento de usuario/tenant.
- [ ] T040 Persistir aprendizajes en memoria (`project-visit-scheduling` + gotchas Google/SMTP/timezone) y marcar pendientes de verificación humana (verificación de la app por Google para producción). Actualizar `MEMORY.md`.

---

## Dependencias y orden

- **Setup (T001-T004)** → **Foundational (T005-T008)** bloquean todo.
- **US1 (T009-T014)** depende de Foundational. Es el MVP entregable.
- **US2 (T015-T020)** depende de US1 (availability) — núcleo del valor conversacional.
- **US3 (T021-T026)** depende de la base de `service.ts` (US2 para enganchar notify; el cron es independiente).
- **US4 (T027-T034)** mejora US1 (freeBusy) y US2 (sync evento); el agente ya funciona degradado sin ella.
- **Phase 7** tras todas; el live E2E necesita credenciales del dueño (T036).

## Paralelizables (ejemplos)

- Setup: T002, T003, T004 en paralelo.
- Foundational: T007, T008 en paralelo (tras T005/T006 para tipos que toquen schema).
- US1: T009, T011, T012 son `[P]` (archivos distintos); T010/T013 dependen de ellos.
- US4: T027, T028, T032 `[P]`; T029/T030/T031 dependen del client.

## MVP sugerido

**US1 sola** (T001-T014) ya entrega valor: cada asesor controla su disponibilidad real y la ve consultable.
Incremento P1 completo = US1 + US2 (el agente agenda sobre disponibilidad real, degradado sin Google/email).
US3 y US4 son capas P2 aditivas verificables por separado.

## Independent test criteria (resumen)

- **US1**: settings persisten; availability excluye visitas; aislamiento por usuario.
- **US2**: agente propone solo slots válidos; agenda/reprograma/cancela por chat; pipeline avanza a `visit`.
- **US3**: email de confirmación llega; recordatorio 1 h se envía exactamente una vez.
- **US4**: freeBusy bloquea; evento se crea/mueve/borra; token inválido → reconnect + degradación.
