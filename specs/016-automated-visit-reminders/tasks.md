# Tasks: Recordatorio de Visitas al Cliente por WhatsApp (016-automated-visit-reminders)

## Phase 1 — Data Model & Migration
- [x] T001 Añadir columna `reminderWaSentAt` a la tabla `showing` en `src/lib/db/schema/domain.ts`
- [x] T002 Crear migración aditiva `drizzle/0012_showing_wa_reminder.sql` y registrarla en `drizzle/meta/_journal.json`

## Phase 2 — Motor de Notificación por WhatsApp
- [x] T003 Implementar servicio `sendDueClientWaReminders` en `src/server/showings/client-reminder.ts`
- [x] T004 Conectar la ejecución en `src/app/api/cron/visit-reminders/route.ts`

## Phase 3 — Verificación
- [x] T005 Pasar el gate técnico de calidad: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
