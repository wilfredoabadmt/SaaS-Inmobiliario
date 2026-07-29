# Quickstart — 011-visit-scheduling

Setup de dependencias externas + variables de entorno + scheduled tasks + guion del self-test E2E.

## 1. Dependencias npm

```bash
pnpm add nodemailer luxon
pnpm add -D @types/nodemailer @types/luxon
```

## 2. Variables de entorno nuevas (todas opcionales/degradables)

Añadir a `src/lib/env.ts` (con `.default("")` y placeholders de build, patrón Instagram) y a Coolify
(runtime, `is_buildtime=false` — ver memoria de exposición de secretos):

```bash
# Google Calendar OAuth (por usuario). Si faltan → la conexión Google queda OFF (degrada a local).
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://inmox-dev.kevinbelier.cloud/api/calendar/google/callback

# Email saliente (Gmail SMTP + App Password). Si faltan → emails OFF (degrada, no rompe agendado).
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=<app-password-de-16-caracteres>   # NO la contraseña normal de Gmail
SMTP_FROM=tu-correo@gmail.com
MAIL_FROM_NAME=Inmox

# Ya existe; reutilizado por el cron de recordatorios:
CRON_SECRET=...
```

Helpers en env: `isGoogleCalendarConfigured(env)` (client id+secret+redirect) e `isEmailConfigured(env)`
(host+user+pass). Endpoints/servicios consultan estos helpers y degradan si son `false`.

## 3. Google Cloud Console (lo hace el dueño — credencial externa)

1. Crear/usar un proyecto en <https://console.cloud.google.com>.
2. **APIs & Services → Library** → habilitar **Google Calendar API**.
3. **OAuth consent screen**: tipo *External*; estado **Testing**; agregar `tu-correo@gmail.com` (y cualquier
   cuenta de prueba) como **Test users**. Scopes: `.../auth/calendar.events` y `.../auth/calendar.readonly`.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized redirect URI: `https://inmox-dev.kevinbelier.cloud/api/calendar/google/callback`
   - (para túnel local: añadir también la URI del túnel).
5. Copiar **Client ID** y **Client secret** a las env vars.

> **Pendiente de verificación humana**: para PRODUCCIÓN (fuera de Testing) Google exige verificar la app por
> usar scopes sensibles de Calendar. Con la cuenta de prueba en Testing funciona sin verificación — suficiente
> para el self-test.

## 4. Gmail App Password (lo hace el dueño — credencial externa)

1. La cuenta `tu-correo@gmail.com` debe tener **Verificación en 2 pasos** activada.
2. Google Account → **Security → 2-Step Verification → App passwords** → generar una para "Mail".
3. Pegar la contraseña de 16 caracteres en `SMTP_PASS` (sin espacios).

## 5. Migración de base de datos

```bash
# Escribir a mano drizzle/0009_visit_scheduling.sql (ver data-model.md) + entrada en _journal.json
# + meta/0009_snapshot.json reconciliado (flujo manual del repo, [[gotcha-drizzle-data-migration]]).
pnpm db:migrate   # aplica en deploy vía Pre-Deployment Command de Coolify
```

## 6. Scheduled tasks en Coolify

- **Existente**: `instagram-refresh` (diaria) — sin cambios.
- **NUEVA**: recordatorios de visita, cada ~5 min:
  ```bash
  curl -fsS -X POST "https://inmox-dev.kevinbelier.cloud/api/cron/visit-reminders" \
    -H "X-Cron-Secret: $CRON_SECRET"
  ```
  Cron expression: `*/5 * * * *`.

## 7. Self-test E2E de comportamiento (Definición de Hecho REFORZADA)

Conducido por el agente (yo), no delegado. Usa el skill `whatsapp-ai-agent-selftest` (línea de prueba
Evolution `…462…9768` → número de la plataforma) + verificación en Google Calendar y en la bandeja de Gmail
del asesor.

**Camino feliz**:
1. Como asesor (owner de la org de prueba): en `/showings` configurar horas hábiles (p. ej. hoy/mañana
   10:00–18:00, slot 45, buffer 15) → guardar → recargar persiste.
2. Conectar Google Calendar de la cuenta de prueba (OAuth) → estado "conectado".
3. Crear en Google Calendar un evento ocupado a una hora dentro del horario hábil.
4. Desde el número de prueba (WhatsApp), conversación real: pedir ver una propiedad (que exista en
   inventario y haya match / o tocar "Agendar visita" en una ficha).
5. Verificar que el agente **propone 2-3 slots concretos** que **excluyen** el horario ocupado en Google.
6. Elegir un slot → el agente confirma la visita.
7. Verificar **(i)** aparece en `/showings`; **(ii)** se creó el **evento** en Google Calendar;
   **(iii)** llegó el **email de confirmación** al asesor (con cliente/propiedad/fecha + link a bandeja).
8. Pedir por WhatsApp **reprogramar** → el agente ofrece slots y mueve la visita → el evento de Google se
   **mueve** + email de reprogramación.
9. Pedir **cancelar** → visita `cancelada` + evento de Google **borrado** + email de cancelación.
10. Forzar la ventana del recordatorio (agendar una visita ~50-60 min en el futuro, o ajustar `scheduled_at`)
    → invocar el cron → verificar **un** email de recordatorio; segunda corrida **no** reenvía.

**Camino infeliz** (provocar y comprobar degradación sin colgarse):
- **Google desconectado** → disponibilidad cae a horas hábiles − visitas Inmox; agendar funciona sin evento.
- **Slot ocupado entre propuesta y confirmación** → no se ofrece / se rechaza con alternativa (cero
  doble-booking).
- **Token de Google expirado/revocado** → estado `reconnect_required`; freeBusy y escritura se omiten; la
  visita en Inmox igual se crea; la UI invita a reconectar.
- **SMTP caído / sin email del asesor** → el agendado no se cae; se loguea el fallo.
- **Formato no-JSON / respuesta vacía del LLM** → el turno degrada (no agenda inválido), sin marcar
  `ai_error` a la primera.
- **Aislamiento**: un segundo usuario/tenant no ve la configuración, visitas ni disponibilidad del primero.

**Gate técnico antes del live**: `pnpm typecheck && pnpm lint && pnpm build` en verde.
