# Research & Decisiones — 011-visit-scheduling

Decisiones técnicas (DV-VS-N) tomadas para esta feature. Las 3 de mayor impacto se confirmaron con el dueño
**antes** de redactar (sync Google bidireccional · email Gmail SMTP+App Password · agente propone slots
concretos); el resto son defaults razonables sobre los patrones existentes del repo.

## DV-VS-1 — Modelado de calendario POR USUARIO (no por organización)

**Decisión**: las tablas nuevas (`calendar_settings`, `google_calendar_credentials`) llevan **ambos**
`organization_id` (scope de tenant, constitución III) **y** `user_id` (el asesor dueño), con UNIQUE en
`(organization_id, user_id)`. Toda lectura/escritura filtra por los dos.

**Rationale**: el dueño definió el producto como SaaS de **agentes independientes**: cada asesor tiene su
propio calendario y agenda. Es la primera entidad por-usuario del repo (las previas eran por-org), pero no
rompe el aislamiento de tenant: lo refina. Mantener `organization_id` deja la puerta abierta a políticas de
equipo futuras sin migración destructiva.

**Alternativas descartadas**: (a) solo `user_id` → perdería el scope de tenant explícito que exige la
constitución; (b) por-organización (un calendario compartido) → contradice la decisión del dueño y obligaría
a re-modelar al introducir agentes independientes.

## DV-VS-2 — Asesor de la visita = `agentId` que ya resuelve `showings/service.ts`

**Decisión**: la disponibilidad y la agenda que el agente IA ofrece en una conversación son las del **asesor
dueño de la conversación** (`conversation.assignedAgentId`, o el owner/fallback que ya calcula
`resolveAgentId`). No hay selección entre varios asesores.

**Rationale**: coherente con DV-VS-1 (independientes) y reusa la resolución existente sin tocar el flujo del
agente. La asignación cruzada es OOS-2.

## DV-VS-3 — Disponibilidad: **slots inyectados en el contexto**, no tool-loop multi-paso

**Decisión**: el agente sigue siendo **single-shot JSON** (como hoy). Cuando hay propiedad de interés (o el
cliente expresa intención de visita), el servidor **pre-computa** los slots disponibles del asesor y las
visitas activas del cliente y los **inyecta en el bloque de contexto** (igual que ya inyecta `matches`). El
modelo solo **elige y propone** 2-3 de esa lista; al confirmar, emite `schedule_visit/reschedule_visit/
cancel_visit` y el **servidor valida** que el `whenISO` ∈ slots ofrecidos y que `propertyId`/`showingId` son
reales (anti-alucinación, espejo de `validIds`).

**Rationale**: la arquitectura actual (`runAgentForInboundMessage` → un `chatJson`) no tiene loop de
herramientas. Inyectar disponibilidad encaja sin reescribir el agente, elimina alucinación de horarios y es
determinista. Reusa el patrón probado de `matches`.

**Alternativas descartadas**: function-calling con round-trips (OpenRouter) → reescribiría el agente,
añadiría latencia y más superficie de fallo de formato del LLM; innecesario para "elegir entre slots dados".

## DV-VS-4 — Validación del slot en el momento de ejecutar (doble-check)

**Decisión**: además de validar `whenISO ∈ slots ofrecidos`, `createShowingFromAgent`/`rescheduleShowing`
**re-calculan disponibilidad** justo antes de insertar y rechazan si el slot se ocupó entre la propuesta y la
confirmación; en ese caso el agente ofrece alternativas (no doble-agenda).

**Rationale**: hay segundos/minutos entre que el modelo propone y el cliente elige; otro evento de Google o
una visita pueden ocupar el slot. SC-003 exige cero doble-booking.

## DV-VS-5 — Frontera `src/lib/google` por **fetch directo** (sin `googleapis`)

**Decisión**: implementar exchange/refresh de OAuth + `freeBusy.query` + `events.insert/patch/delete` con
`fetch` contra los endpoints REST de Google, aislados en `src/lib/google`. No se añade el SDK `googleapis`.

**Rationale**: consistente con `lib/meta` y `lib/instagram` (ambos hand-rolled por fetch); `googleapis` es
una dependencia grande para 4 llamadas. Mantiene la frontera fina y portable.

**Endpoints usados**:
- Authorize: `https://accounts.google.com/o/oauth2/v2/auth` (`access_type=offline`, `prompt=consent` para
  garantizar `refresh_token`).
- Token: `https://oauth2.googleapis.com/token` (code→tokens y refresh).
- freeBusy: `POST https://www.googleapis.com/calendar/v3/freeBusy`.
- Events: `POST/PATCH/DELETE https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`.

## DV-VS-6 — Scopes de Google y refresh token

**Decisión**: scopes = `https://www.googleapis.com/auth/calendar.events` (escribir eventos) +
`https://www.googleapis.com/auth/calendar.readonly` (leer freeBusy). Guardar `refresh_token` (cifrado
aparte del `access_token`) y refrescar **on-demand** cuando el access token esté por expirar, además de un
cron de mantenimiento opcional.

**Rationale**: scopes mínimos que cubren leer ocupado + escribir eventos. `prompt=consent` +
`access_type=offline` aseguran refresh token la primera vez. On-demand refresh evita depender de la cadencia
del cron para que el agente funcione.

**Pendiente de verificación humana**: para **producción** Google exige verificar la app por usar scopes
sensibles de Calendar; en **testing** la cuenta de prueba se agrega como *test user* y funciona sin
verificación. No bloquea el self-test.

## DV-VS-7 — Cifrado de tokens: dos blobs `seal/open` (access y refresh por separado)

**Decisión**: reusar `seal/open` (AES-256-GCM, `src/lib/crypto`) y guardar **dos** conjuntos de columnas:
`encrypted_access_token/access_iv/access_auth_tag` (+ `access_token_expires_at`) y
`encrypted_refresh_token/refresh_iv/refresh_auth_tag`. El refresh se re-sella solo si Google emite uno nuevo.

**Rationale**: el access token rota seguido; el refresh es estable y a veces ausente en refrescos. Separarlos
evita perder el refresh al actualizar el access. Mismo helper de cifrado que IG/WhatsApp (Principio I).

## DV-VS-8 — Timezone con `luxon`

**Decisión**: añadir `luxon` para convertir horas hábiles en wall-clock + timezone del asesor a instantes
UTC y de vuelta para las etiquetas, manejando DST correctamente.

**Rationale**: SC-003 exige slots válidos; la aritmética manual de offsets con `Intl` es frágil en
transiciones DST. `America/Mexico_City` hoy no aplica DST, pero el campo es configurable (otras zonas sí). `luxon`
es pequeño, estable y la opción estándar para esto.

**Alternativas descartadas**: `Intl.DateTimeFormat.formatToParts` a mano (frágil en DST); `date-fns-tz`
(equivalente; luxon tiene API de zonas más directa); `moment-timezone` (legacy/pesado).

## DV-VS-9 — Email: `nodemailer` + Gmail SMTP con App Password (remitente único temporal)

**Decisión**: frontera `src/lib/mail` con `nodemailer` apuntando a `smtp.gmail.com:587` (STARTTLS),
autenticado con `SMTP_USER`=tu-correo@gmail.com + `SMTP_PASS`=App Password. Remitente único temporal. Envío
**best-effort**: `sendMail` captura errores y **no lanza** (un fallo de email nunca tumba el agendado;
FR-017). Se loguea el fallo sin secretos.

**Rationale**: lo pidió el dueño (mandar temporalmente desde su Gmail). App Password es el camino soportado
por Google para SMTP de terceros con 2FA. Migrar a dominio propio / servicio transaccional es OOS-4.

**Alternativas descartadas**: Resend (requiere dominio verificado para remitir "como tú"; el dueño quiere su
Gmail); API de Gmail vía el mismo OAuth (enviaría "en nombre de cada asesor", no un remitente central
temporal; más complejo).

## DV-VS-10 — Recordatorio 1 h: cron frecuente idempotente (separado del `remind_at` de 24 h)

**Decisión**: endpoint `POST /api/cron/visit-reminders` protegido por `CRON_SECRET`, **scheduled task de
Coolify cada ~5 min**. Selecciona `showing` con `status='agendada'`, `reminder_email_sent_at IS NULL`,
`scheduled_at > now()` y `scheduled_at <= now() + ~65 min`; envía el email al asesor y marca
`reminder_email_sent_at = now()` (idempotente). El `remind_at` (24 h) **no se toca**: queda como placeholder
del recordatorio al CLIENTE por WhatsApp (OOS-1).

**Rationale**: "1 hora antes" necesita granularidad de minutos; un cron diario no sirve. La marca
`reminder_email_sent_at` garantiza un único envío aun con corridas solapadas (Principio IV). Ventana de 65
min cubre el caso de que el cron corra justo después de cruzar la marca de −60 min.

**Nota de infra**: hay que crear una **segunda scheduled task** en Coolify (la actual de IG es diaria). Se
documenta en quickstart.

## DV-VS-11 — Sincronización idempotente del evento de Google (por `google_event_id`)

**Decisión**: al agendar, si el asesor tiene Google conectado, crear el evento y guardar
`showing.google_event_id`. Al reprogramar, `PATCH` ese evento (start/end). Al cancelar, `DELETE` ese evento
(o marcarlo cancelado) y dejar `google_event_id` para traza. Si `google_event_id` ya existe al "crear", se
hace `PATCH` en vez de duplicar. Toda llamada a Google es **best-effort para el lado Inmox**: si falla
(token inválido), se marca `reconnect_required` y la visita en Inmox **igual se crea/mueve/cancela**
(degradación, FR-022).

**Rationale**: idempotencia (IV) + la operación de Inmox no debe depender de Google. El `google_event_id`
es la llave de actualización.

## DV-VS-12 — Duración efectiva persistida (`showing.duration_minutes`)

**Decisión**: al crear la visita se captura `duration_minutes` desde los `calendar_settings` del asesor en
ese momento (default 60). Se usa para el `end` del evento de Google y para el cálculo de solape en
disponibilidad. Columna aditiva nullable con default lógico.

**Rationale**: si el asesor cambia su slot después, las visitas ya creadas conservan su duración real; el
solape y el evento de Google quedan estables.

## DV-VS-13 — Degradaciones (resumen)

- **Sin Google conectado** → disponibilidad = horas hábiles − visitas Inmox; agendar no crea evento (sin
  error). (FR-008/FR-018)
- **Token de Google inválido/revocado** → `reconnect_required`; freeBusy se omite (disponibilidad local);
  escritura de evento se omite; la UI muestra "reconectar". La operación de Inmox continúa. (FR-022)
- **SMTP no configurado o email del asesor ausente** → se omite el envío y se loguea; el agendado sigue.
  (FR-017)
- **Salida no-JSON/vacía del LLM** → el agente ya degrada (try/catch + extracción laxa actual); no se agenda
  nada inválido. (FR-013)
- **Slot ocupado entre propuesta y confirmación** → rechazo + alternativas (DV-VS-4).

## DV-VS-14 — Defaults de `calendar_settings`

**Decisión**: si un asesor no tiene fila, `getSettings` devuelve un default **virtual** (no se persiste hasta
que guarde): L–V activos 09:00–18:00, slot 60 min, buffer 0 min, tz `America/Mexico_City`. Formato de horas
hábiles: JSON por día de la semana con lista de intervalos `{start:"HH:MM", end:"HH:MM"}` (permite partir el
día, p. ej. mañana/tarde).

**Rationale**: el asesor ve algo usable de inmediato (US1 escenario 1) sin escritura previa; el JSON por-día
con intervalos cubre comidas/horarios partidos sin tablas extra.

## Reutilización (lo que NO se reinventa)

- `showing` + `createShowingFromAgent` + `ensureCandidacy` + ancla `visit`/`advanceStageForward` (010).
- `seal/open` (`src/lib/crypto`), patrón `state` HMAC y ciclo de credenciales (008 Instagram).
- Patrón de cron con `CRON_SECRET` (008) + scheduled task de Coolify.
- `requireMember`/`getActiveContext` (guards) para scope tenant + identidad de usuario.
- Patrón anti-alucinación del agente (`validIds`) y degradación con `needsHuman`/`ai_error`.
- `newId('showing')` + prefijos de ID; añadir prefijos `calendarSettings` (`calset`) y
  `googleCalendarCredentials` (`gcal`).
