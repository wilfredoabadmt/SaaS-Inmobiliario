# Plan Técnico: Recordatorio Automático de Visitas al Cliente por WhatsApp (016-automated-visit-reminders)

## 1. Constitution Check

- **Principio I (Seguridad de datos)**: Los números de teléfono y tokens se manejan con aislamiento de tenant y cifrado en reposo.
- **Principio IV (Idempotencia en Integraciones Externas)**: Columna `reminder_wa_sent_at` en `showing`. Solo se envían visitas con `reminder_wa_sent_at IS NULL`. Se sella la fecha antes/después del intento para evitar reintentos en ráfaga.
- **Principio VIII (Foco Inmobiliario)**: Notificación al cliente prospecto con fecha, hora, asesor y propiedad a visitar.

---

## 2. Base de Datos

- Campo aditivo en `src/lib/db/schema/domain.ts`:
  ```typescript
  reminderWaSentAt: timestamp("reminder_wa_sent_at"),
  ```
- Migración `0012_showing_wa_reminder.sql` y entrada en `_journal.json`.

---

## 3. Lógica de Envío (`src/server/showings/client-reminder.ts`)

1. Consulta:
   - `showing.status = 'agendada'`
   - `showing.scheduledAt > now()`
   - `(showing.remindAt <= now() OR showing.scheduledAt <= now() + 24 hours)`
   - `showing.reminderWaSentAt IS NULL`
2. Join con:
   - `property` para obtener `title` y `address`.
   - `candidacy` y `client` para obtener `phone` y `name`.
   - `conversation` para obtener `id`.
   - `user` (asesor) para nombre.
3. Envío:
   - Obtener `getSendingCredentials(orgId)`.
   - Buscar plantilla con categoría `UTILITY` o `name ILIKE '%recordatorio%'` con `status = 'APPROVED'`.
   - Si existe plantilla aprobada: enviar vía `graphRequest` con componentes de variables.
   - Si no existe: si la conversación tiene ventana de 24 h abierta, enviar mensaje de texto libre; si está cerrada, degradar y loggear.
4. Registro de mensaje:
   - Insertar en `message` (`direction: 'outbound'`, `body: ...`, `status: 'sent'`).
   - Actualizar `conversation.lastMessageAt`.
   - Actualizar `showing.reminderWaSentAt = new Date()`.
