# Implementation Plan: Agendamiento de visitas con calendario real (011-visit-scheduling)

**Branch**: `011-visit-scheduling` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-visit-scheduling/spec.md`

## Summary

Convertir `/showings` en un calendario real por asesor. Cuatro bloques sobre la base existente
(`showing` + `createShowingFromAgent` + ancla `visit` del pipeline 010):

1. **Disponibilidad por asesor**: nueva tabla `calendar_settings` (1:1 por `user` dentro de la org:
   horas hábiles por día, duración de slot, buffer, timezone) + motor `availability.ts` que genera slots
   libres = horas hábiles − visitas Inmox − ocupado de Google (si conectado), todo en instantes UTC.
2. **Agente IA agenda**: se **inyecta** la disponibilidad (y las visitas activas del cliente) en el contexto
   del turno —como ya se inyectan los `matches`— y el modelo **propone 2-3 slots concretos** de esa lista;
   el servidor valida y ejecuta `schedule_visit` / `reschedule_visit` / `cancel_visit` (anti-alucinación:
   solo slots ofrecidos y `showingId`/`propertyId` reales). Reusa `createShowingFromAgent`.
3. **Google Calendar OAuth bidireccional por usuario**: frontera nueva `src/lib/google` (espejo de
   `lib/instagram`: state HMAC, exchange/refresh por fetch, freeBusy + events) + tabla
   `google_calendar_credentials` (1:1 por `user`, access+refresh cifrados con `seal/open`). LECTURA freeBusy
   para bloquear disponibilidad; ESCRITURA crear/mover/borrar evento al agendar/reprogramar/cancelar
   (`showing.google_event_id`). Token inválido → `reconnect_required` + degradación.
4. **Email al asesor**: frontera `src/lib/mail` (nodemailer → Gmail SMTP + App Password, remitente único
   temporal). Confirmación inmediata al agendar/reprogramar/cancelar (best-effort) + **recordatorio 1 h
   antes** vía cron frecuente idempotente (`showing.reminder_email_sent_at`, patrón `CRON_SECRET`).

**Fuera de alcance (cascarón):** recordatorio al CLIENTE por plantilla de WhatsApp/llamada (otra spec). El
`showing.remind_at` (24 h) y el banner actual de la lista quedan como placeholder; no se construye envío al
cliente aquí.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Node.js runtime.

**Primary Dependencies**: Next.js 15 (App Router) · Drizzle ORM + PostgreSQL · Better Auth (plugin
`organization`) · Zod. **Nuevas**: `nodemailer` (+ `@types/nodemailer`) para SMTP; `luxon`
(+ `@types/luxon`) para aritmética de timezone/DST correcta en la generación de slots. Google Calendar y
Google OAuth se consumen por **fetch directo** (sin `googleapis`), aislados en `src/lib/google` (consistente
con `lib/meta` / `lib/instagram`).

**Storage**: PostgreSQL. Tablas nuevas `calendar_settings`, `google_calendar_credentials`; columnas
aditivas en `showing` (`google_event_id`, `reminder_email_sent_at`, `duration_minutes`). Migración Drizzle
**aditiva** (sin backfill destructivo).

**Testing**: `pnpm typecheck` + `pnpm lint` + `pnpm build` (gate) y **self-test E2E de comportamiento**
(WhatsApp real vía Evolution + verificación en Google Calendar + bandeja de email del asesor).

**Target Platform**: App Next.js en Coolify (inmox-dev), Postgres separado, crons por scheduled task de
Coolify.

**Project Type**: Web app (App Router: route handlers `src/app/api/**` + componentes server/client +
servicios `src/server/**` + fronteras `src/lib/**`).

**Performance Goals**: cómputo de disponibilidad para una ventana de ~7 días en una sola lectura de
`showing` + una llamada freeBusy; el turno del agente añade ≤1 llamada freeBusy. Sin objetivos de throughput
especiales (escala de agencia pequeña).

**Constraints**: multi-tenant por `organization_id`; settings y tokens **además** por `user`; secretos
cifrados en reposo, nunca al cliente ni a logs; idempotencia en cron y en escritura a Google
(`google_event_id`); toda integración externa aislada tras adaptador; degradación si falta Google o SMTP.

**Scale/Scope**: ~3 tablas tocadas, ~11 endpoints nuevos, 2 fronteras nuevas (`lib/google`, `lib/mail`),
3 acciones nuevas del agente, 1 pantalla extendida, 2 crons (1 nuevo: recordatorios).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Seguridad de Datos Primero (NO NEGOCIABLE)** — ✅ Tokens de Google (access + refresh) cifrados
  AES-256-GCM vía `seal/open`; nunca se devuelven al cliente ni se escriben en logs. App Password de Gmail
  vive solo en env (no en código/VCS). Estado de conexión a la UI sin token. Aislamiento por tenant **y**
  por usuario (settings/tokens/visitas/disponibilidad nunca cruzan usuarios).
- **II. Soberanía / Self-Hosted** — ✅ El core (auth + Postgres) sigue self-hosted. Google Calendar y Gmail
  SMTP son integraciones externas **no-core**, aisladas tras fronteras dedicadas (`src/lib/google`,
  `src/lib/mail`), igual que WhatsApp/Instagram. No se acopla el dominio a sus APIs; degrada si faltan.
- **III. Multi-Tenancy Real** — ✅ `organization_id` de primer nivel en tablas nuevas; autorización vía
  `requireMember`. La dimensión por-usuario es **adicional** (cada asesor su calendario), no sustituye el
  scope de tenant.
- **IV. Idempotencia en Integraciones Externas** — ✅ Cron de recordatorios idempotente
  (`reminder_email_sent_at`); callback OAuth con `state` HMAC + `exp`; escritura a Google idempotente por
  `google_event_id` (crear si null, si no actualizar). Reusa la regla "solo avanzar" del pipeline.
- **V. Calidad Verificable Antes de "Hecho" (NO NEGOCIABLE)** — ✅ Gate técnico + self-test E2E conducido
  por el agente; lo no verificable (verificación de la app por Google para producción) se marca pendiente de
  verificación humana.
- **VI. Specs Antes de Código** — ✅ spec.md aprobado antes de este plan.
- **VII. Trazabilidad de Decisiones** — ✅ Decisiones DV-VS-1…N en research.md; supuestos en spec.
- **VIII. Foco Vertical Inmobiliario** — ✅ Citas de muestra (visitas) están explícitas en el Principio
  VIII; esta feature las vuelve operativas.

**Resultado: PASS, sin violaciones.** Complexity Tracking vacío.

## Project Structure

### Documentation (this feature)

```text
specs/011-visit-scheduling/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones DV-VS-1…N
├── data-model.md        # Fase 1 — tablas/columnas nuevas + entidades
├── quickstart.md        # Fase 1 — setup Google Cloud + Gmail App Password + cron + self-test
├── contracts/
│   └── api.md           # Fase 1 — endpoints /api/calendar/** + cron + mutaciones de showing
└── checklists/
    └── requirements.md  # Calidad del spec (ya creado)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── google/                      # NUEVA frontera (espejo de lib/instagram)
│   │   ├── index.ts                 # client fetch: exchangeCode, refreshToken, freeBusy, events CRUD
│   │   └── state.ts                 # signState/verifyState (HMAC con BETTER_AUTH_SECRET; org+user+exp)
│   ├── mail/                        # NUEVA frontera de email
│   │   ├── index.ts                 # transport nodemailer (SMTP) + sendMail (best-effort, no-throw)
│   │   └── templates.ts             # render asunto/cuerpo (confirmación/reprogramación/cancelación/recordatorio)
│   ├── time/
│   │   └── slots.ts                 # helpers luxon: horas hábiles (tz) → instantes UTC, solape
│   └── env.ts                       # + GOOGLE_*, SMTP_* (opcionales/degradables) + helpers isXConfigured
├── server/
│   ├── calendar/
│   │   ├── settings.ts              # get(con defaults)/upsert de calendar_settings (por user)
│   │   ├── availability.ts          # motor de slots libres (settings − showings − freeBusy)
│   │   ├── google.ts                # saveCredentials/getCredentials/status/disconnect/refresh + sync evento
│   │   ├── notify.ts                # envíos de email del asesor (usa lib/mail + user.email)
│   │   └── reminders.ts             # lógica del cron de recordatorio 1 h (idempotente)
│   └── showings/
│       ├── service.ts               # EXTENDER: duración, validar slot, sync Google, notificar;
│       │                            #   + rescheduleShowing / cancelShowing
│       └── queries.ts               # + visitas activas por cliente (para el contexto del agente)
├── server/ai/
│   ├── prompts.ts                   # EXTENDER: JSON de acción (reschedule/cancel) + bloque slots/visitas
│   └── agent.ts                     # EXTENDER: ACTION_TYPES + normalizeAction(showingId) + ejecución
├── app/
│   ├── (dashboard)/showings/
│   │   ├── page.tsx                 # EXTENDER: render settings + estado Google + lista (+ agenda opcional)
│   │   └── ...                      # componentes de settings/conexión (client)
│   └── api/
│       ├── calendar/
│       │   ├── settings/route.ts        # GET, PUT
│       │   ├── availability/route.ts    # GET
│       │   └── google/
│       │       ├── status/route.ts      # GET
│       │       ├── connect/route.ts     # GET → 302 a Google authorize
│       │       ├── callback/route.ts    # GET (code+state) → guarda credenciales
│       │       └── disconnect/route.ts  # POST
│       ├── showings/[id]/
│       │   ├── reschedule/route.ts      # POST (UI manual)
│       │   ├── cancel/route.ts          # POST (UI manual)
│       │   └── status/route.ts          # PATCH (realizada/no_show, opcional)
│       └── cron/visit-reminders/route.ts # POST (CRON_SECRET) → reminders.ts
└── lib/db/schema/domain.ts          # + calendar_settings, google_calendar_credentials, columnas en showing

drizzle/
└── 0009_visit_scheduling.sql        # migración aditiva (2 tablas + 3 columnas en showing + enum)
```

**Structure Decision**: Web app monorepo existente. Se reutiliza el patrón "frontera `lib/*` por
integración externa + servicios `server/*` por dominio + route handlers `app/api/*`". Google y email entran
como **dos fronteras nuevas e independientes** (no se mezclan con `lib/meta`), espejando exactamente cómo
008 aisló Instagram. La dimensión **por-usuario** (settings + tokens de Google) es la única novedad de
modelado respecto a features previas, que eran por-organización.

## Complexity Tracking

> Sin violaciones constitucionales que justificar. (Vacío.)

## Phases

- **Fase 0 — research.md**: decisiones DV-VS-1…N (modelado por-usuario, scopes de Google, freeBusy vs
  events.list, slots inyectados vs tool-loop, luxon vs Intl, nodemailer/Gmail SMTP, cadencia del cron,
  manejo de refresh token, idempotencia de evento, degradaciones).
- **Fase 1 — data-model.md, contracts/api.md, quickstart.md**: esquema exacto, contratos de endpoints,
  y guía de setup (Google Cloud Console, App Password Gmail, scheduled tasks de Coolify) + guion del
  self-test E2E.
- **Fase 2 — tasks.md**: lo genera `/speckit-tasks` (no este comando).
