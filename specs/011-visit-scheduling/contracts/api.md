# API Contracts — 011-visit-scheduling

Todos los endpoints (salvo el cron y el callback OAuth) exigen sesión vía `requireMember()` y operan scoped
por `organization_id` + `userId` del contexto activo. Errores con forma `{ error: { code, message } }`.
Ningún endpoint devuelve tokens ni secretos.

## Calendar settings

### `GET /api/calendar/settings`
Devuelve la configuración del **usuario actual** (o el default virtual si no tiene fila).
```json
200 {
  "weeklyHours": { "mon": [{"start":"09:00","end":"18:00"}], "tue": [...], "...": [] },
  "slotMinutes": 60,
  "bufferMinutes": 0,
  "timezone": "America/Mexico_City",
  "isDefault": true
}
```

### `PUT /api/calendar/settings`
Upsert de la configuración del usuario actual. Body validado con Zod (ver data-model: `start<end`, sin
solapes, `slotMinutes∈[10,480]`, `bufferMinutes∈[0,240]`, tz IANA válida).
```json
// body
{ "weeklyHours": {...}, "slotMinutes": 45, "bufferMinutes": 15, "timezone": "America/Mexico_City" }
200 { "ok": true }
400 { "error": { "code": "invalid_settings", "message": "..." } }
```

## Availability

### `GET /api/calendar/availability?from=ISO&to=ISO&agentId=optional`
Slots libres del asesor (default = usuario actual; `agentId` debe ser miembro de la org). Ventana máx ~14
días. Usado por la UI (agenda) y reutilizable para depurar lo que ve el agente.
```json
200 {
  "agentId": "usr_...",
  "timezone": "America/Mexico_City",
  "googleConnected": true,
  "slots": [
    { "startUtc": "2026-06-25T16:00:00.000Z", "endUtc": "2026-06-25T17:00:00.000Z", "label": "mié 25 jun, 10:00" }
  ]
}
```
Degradación: `googleConnected:false` o `reconnect_required` → slots solo de horas hábiles − visitas Inmox.

## Google Calendar OAuth (por usuario)

### `GET /api/calendar/google/status`
```json
200 { "status": "connected" | "reconnect_required" | "disconnected" | "none",
      "email": "agente@gmail.com" | null, "calendarId": "primary" | null, "connectedAt": "..." | null }
```

### `GET /api/calendar/google/connect`
`302` → URL de autorización de Google (`access_type=offline`, `prompt=consent`, scopes calendar.events +
calendar.readonly, `state` HMAC con `organizationId.userId.nonce.exp`). Si `GOOGLE_*` no está configurado →
`501 { error: { code: "google_not_configured" } }`.

### `GET /api/calendar/google/callback?code=&state=`
Verifica `state` (firma + exp). Intercambia `code` → tokens; obtiene `sub`/`email` (del id_token o
userinfo); guarda credenciales cifradas (DV-VS-7). Redirige a `/showings?google=connected` (o
`?google=error`). Idempotente por `(organization_id,user_id)` (onConflictDoUpdate).

### `POST /api/calendar/google/disconnect`
Borra la fila de credenciales del usuario actual (revoca opcionalmente el token en Google, best-effort).
```json
200 { "ok": true }
```

## Mutaciones de visita (UI manual; el agente reusa los servicios directamente)

### `POST /api/showings/[id]/reschedule`
```json
// body
{ "whenISO": "2026-06-26T17:00:00.000Z" }
200 { "ok": true }
409 { "error": { "code": "slot_taken", "message": "Ese horario ya no está disponible" } }
404 { "error": { "code": "not_found" } }   // o no pertenece al tenant
```
Efecto: valida slot disponible para el `agent_id` de la visita; actualiza `scheduled_at` (+ `duration`);
`PATCH` del evento de Google si conectado; email de reprogramación (best-effort).

### `POST /api/showings/[id]/cancel`
```json
200 { "ok": true }
```
Efecto: `status='cancelada'`; `DELETE` del evento de Google si existe; email de cancelación (best-effort).

### `PATCH /api/showings/[id]/status` (opcional)
Body `{ "status": "realizada" | "no_show" }` para cerrar la visita desde la lista. No toca Google.

## Cron — recordatorio 1 h por email

### `POST /api/cron/visit-reminders`
Protegido por `CRON_SECRET` (header `X-Cron-Secret` o `?secret=`). Lo dispara una **scheduled task de
Coolify cada ~5 min**.
```json
200 { "sent": 3, "scanned": 12 }
401 { "error": { "code": "unauthorized", "message": "Cron no autorizado" } }
```
Lógica (idempotente): selecciona `showing` con `status='agendada'`, `reminder_email_sent_at IS NULL`,
`scheduled_at > now()`, `scheduled_at <= now() + interval '65 minutes'`; por cada una envía email al asesor
(`user.email` por `agent_id`) y setea `reminder_email_sent_at = now()`. Un fallo de email individual no aborta
el lote (best-effort por fila).

## Acciones del agente IA (no es HTTP; contrato del JSON del modelo)

`ACTION_TYPES` extendido: `none | send_sheet | schedule_visit | reschedule_visit | cancel_visit | handoff`.
El servidor valida e ejecuta; el modelo solo decide. Bloque `action` del JSON:

```jsonc
"action": {
  "type": "schedule_visit",
  "propertyId": "prop_… | null",   // requerido en schedule_visit (match real o interés)
  "showingId": "show_… | null",    // requerido en reschedule_visit / cancel_visit (visita activa del cliente)
  "whenISO": "ISO 8601 | null",    // requerido en schedule_visit / reschedule_visit (debe ∈ slots ofrecidos)
  "reason": "string | null"
}
```

**Inyección de contexto** (DV-VS-3): el bloque de contexto del turno incluye, cuando aplica:
- `Slots disponibles del asesor (elige y propón 2-3, usa su startUtc como whenISO): [{startUtc,label}, ...]`
- `Visitas activas de este cliente (para reprogramar/cancelar usa su showingId): [{showingId, propiedad, label}, ...]`

**Validación del servidor** (anti-alucinación, espejo de `validIds`):
- `schedule_visit`: `propertyId ∈ validIds` (matches/interés) **y** `whenISO ∈ startUtc de slots ofrecidos`
  **y** re-check de disponibilidad (DV-VS-4). → `createShowingFromAgent` extendido.
- `reschedule_visit`: `showingId` pertenece a una visita activa del cliente de la conversación **y**
  `whenISO ∈ slots`. → `rescheduleShowing`.
- `cancel_visit`: `showingId` pertenece al cliente de la conversación. → `cancelShowing`.
- Cualquier desajuste → no se ejecuta la acción; el `reply` igual se envía (degrada sin tumbar el turno).
