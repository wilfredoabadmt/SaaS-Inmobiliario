# Data Model — 011-visit-scheduling

Cambios de esquema (Drizzle / PostgreSQL). Todo **aditivo**: 2 tablas nuevas + 3 columnas en `showing` + 1
enum nuevo. Migración `drizzle/0009_visit_scheduling.sql`. IDs `text` con prefijo (nanoid). Prefijos nuevos
en `src/lib/db/ids.ts`: `calendarSettings='calset'`, `googleCalendarCredentials='gcal'`.

## Enum nuevo: `google_calendar_status`

Valores: `connected` | `reconnect_required` | `disconnected`.
(No se reutiliza `connection_status`/`ig_connection_status` para no acoplar dominios; mismo criterio que 008.)

## Tabla nueva: `calendar_settings` (1:1 por usuario dentro de la org)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | `calset_…` |
| `organization_id` | text FK → organization (cascade) | scope de tenant (III) |
| `user_id` | text FK → user | el asesor dueño |
| `weekly_hours` | jsonb NOT NULL | horas hábiles por día; ver formato abajo |
| `slot_minutes` | integer NOT NULL default 60 | duración reservada por visita |
| `buffer_minutes` | integer NOT NULL default 0 | margen entre visitas |
| `timezone` | text NOT NULL default `'America/Mexico_City'` | IANA tz |
| `created_at` | timestamp NOT NULL defaultNow | |
| `updated_at` | timestamp NOT NULL defaultNow | |

**Índices**: `uniqueIndex('calendar_settings_org_user_uq').on(organization_id, user_id)`.

**Formato `weekly_hours`** (jsonb): objeto por día de semana en inglés-corto; cada día es una lista de
intervalos en wall-clock `HH:MM` (24h) de la `timezone` del asesor. Lista vacía = día no laborable.

```json
{
  "mon": [{ "start": "09:00", "end": "14:00" }, { "start": "16:00", "end": "18:00" }],
  "tue": [{ "start": "09:00", "end": "18:00" }],
  "wed": [{ "start": "09:00", "end": "18:00" }],
  "thu": [{ "start": "09:00", "end": "18:00" }],
  "fri": [{ "start": "09:00", "end": "18:00" }],
  "sat": [],
  "sun": []
}
```

**Validación (Zod en el endpoint)**: `start < end` por intervalo; intervalos no solapados dentro del día;
`HH:MM` válido; `slot_minutes` ∈ [10, 480]; `buffer_minutes` ∈ [0, 240]; `timezone` IANA válida (luxon
`IANAZone.isValidZone`).

**Default virtual** (sin fila persistida): L–V 09:00–18:00, slot 60, buffer 0, tz America/Mexico_City
(DV-VS-14).

## Tabla nueva: `google_calendar_credentials` (1:1 por usuario)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | `gcal_…` |
| `organization_id` | text FK → organization (cascade) | scope de tenant |
| `user_id` | text FK → user | el asesor dueño |
| `google_sub` | text NOT NULL | id estable de la cuenta Google (claim `sub`) |
| `email` | text | email de la cuenta Google conectada (display) |
| `calendar_id` | text NOT NULL default `'primary'` | calendario destino (freeBusy + events) |
| `encrypted_access_token` | text NOT NULL | access token cifrado (AES-256-GCM) |
| `access_iv` | text NOT NULL | |
| `access_auth_tag` | text NOT NULL | |
| `access_token_expires_at` | timestamp NOT NULL | para refrescar on-demand |
| `encrypted_refresh_token` | text | refresh token cifrado (puede faltar en refrescos) |
| `refresh_iv` | text | |
| `refresh_auth_tag` | text | |
| `scope` | text | scopes concedidos (traza) |
| `status` | `google_calendar_status` NOT NULL default `'connected'` | |
| `connected_at` | timestamp | |
| `updated_at` | timestamp NOT NULL defaultNow | |

**Índices**: `uniqueIndex('google_calendar_credentials_org_user_uq').on(organization_id, user_id)`.

**Reglas**:
- `seal/open` cifra access y refresh por separado (DV-VS-7). Nunca se devuelven al cliente ni a logs (I).
- `getCredentials(orgId, userId)` descifra server-only; si `access_token_expires_at` está por vencer
  (margen ~60 s) refresca con el refresh token y re-sella.
- `invalid_grant`/401 de Google → `markReconnectRequired` (status `reconnect_required`); la disponibilidad
  cae a local y la escritura de evento se omite (DV-VS-13).
- `getStatusView` devuelve solo `{status, email, calendarId, connectedAt}` (sin token) para la UI.

## Tabla existente extendida: `showing` (columnas aditivas)

| Columna nueva | Tipo | Notas |
|---|---|---|
| `duration_minutes` | integer | duración efectiva capturada de settings al crear (default lógico 60). DV-VS-12 |
| `google_event_id` | text | id del evento creado en Google Calendar del asesor (null si no conectado). DV-VS-11 |
| `reminder_email_sent_at` | timestamp | marca de idempotencia del recordatorio 1 h por email. DV-VS-10 |

**Sin cambios** en columnas existentes (`scheduled_at`, `remind_at`, `status`, `agent_id`, etc.).
`remind_at` (24 h) **se conserva intacto** como placeholder del recordatorio al cliente por WhatsApp (OOS-1).
El índice existente `showing_org_scheduled_idx (organization_id, scheduled_at)` sirve a la query del cron de
recordatorios.

## Entidad derivada (no persistida): `AvailabilitySlot`

Calculada por `availability.ts`; nunca se guarda.

```ts
interface AvailabilitySlot {
  startUtc: string;   // ISO 8601 UTC (instante exacto del inicio del slot)
  endUtc: string;     // startUtc + slot_minutes
  label: string;      // etiqueta legible en la tz del asesor, p. ej. "mar 25 jun, 10:00"
}
```

**Cálculo** (resumen): para cada día en la ventana [from, to], expandir `weekly_hours[día]` en wall-clock de
la `timezone` → instantes UTC con luxon; segmentar en pasos de `slot_minutes + buffer_minutes`; descartar
slots en el pasado; restar solape con `showing` activos del asesor (`status='agendada'`, usando
`scheduled_at` + `duration_minutes`); si hay Google `connected`, restar solape con los periodos `busy` de
`freeBusy.query`. Resultado ordenado ascendente.

## Relaciones y aislamiento

- `calendar_settings` y `google_calendar_credentials`: **1:1 por (organization_id, user_id)**. Toda consulta
  filtra por ambos. Un asesor jamás ve la configuración/tokens/disponibilidad de otro (I/III).
- `showing.agent_id` → `user.id` (ya existente) es el dueño del calendario que aplica a esa visita.
- Email del asesor: se lee de `user.email` (tabla auth) por `agent_id`.

## Migración `0009_visit_scheduling.sql` (orden)

1. `CREATE TYPE google_calendar_status AS ENUM ('connected','reconnect_required','disconnected');`
2. `CREATE TABLE calendar_settings (...)` + índice único.
3. `CREATE TABLE google_calendar_credentials (...)` + índice único.
4. `ALTER TABLE showing ADD COLUMN duration_minutes integer;`
5. `ALTER TABLE showing ADD COLUMN google_event_id text;`
6. `ALTER TABLE showing ADD COLUMN reminder_email_sent_at timestamp;`

(Sin backfill destructivo; todas las columnas nuevas son nullable o con default. Reconciliar
`meta/0009_snapshot.json` + `_journal.json` por el flujo manual del repo — ver
[[gotcha-drizzle-data-migration]].)
