# Feature Specification: Recordatorio Automático de Visitas al Cliente por WhatsApp (016-automated-visit-reminders)

**Feature Branch**: `016-automated-visit-reminders`  
**Created**: 2026-09-17  
**Status**: In Progress  

**Input**: Automatizar el envío de recordatorios por WhatsApp hacia el cliente ~24 horas antes de cada visita agendada, utilizando la integración oficial de Meta WhatsApp Cloud API y registrando el evento en la conversación del cliente en la bandeja.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Envío Automático del Recordatorio de Visita al Cliente (Priority: P1)

Cuando una visita entra en su ventana de recordatorio (`now() >= remind_at` o dentro de las 24 h previas a la cita) y su estado es `agendada`:
1. El cron periódico escanea la cita.
2. Identifica al cliente, su número de teléfono y la conversación activa de la agencia.
3. Envía el recordatorio por WhatsApp utilizando la plantilla de Meta aprobada para recordatorio de visitas (o mensaje en ventana si está abierta).
4. El mensaje enviado aparece registrado en el hilo de chat de la bandeja (`/inbox`) con estatus "sent".
5. Se marca `showing.reminder_wa_sent_at = now()` para garantizar que el recordatorio se envíe exactamente una sola vez (Principio IV: Idempotencia).

**Why this priority**: Reduce drásticamente el ausentismo (no-show) de prospectos en citas de muestra inmobiliaria.

**Independent Test**: Registrar una visita con `remind_at` en el pasado inmediato, ejecutar el cron `/api/cron/visit-reminders` y comprobar que el recordatorio es enviado, la base de datos registra la marca de tiempo y una segunda ejecución consecutiva no reenvía nada.

---

## Edge Cases

1. **WhatsApp no conectado en la agencia**:
   - Si la agencia no tiene credenciales válidas de Meta (`meta_credentials`), el proceso no colapsa ni interrumpe el resto de recordatorios; registra una advertencia y continúa.
2. **Cliente sin teléfono válido**:
   - Se normaliza el teléfono. Si es inválido, se omite y se sella la marca para no bloquear la cola.
3. **Falla de entrega en Meta**:
   - Se captura el error de Graph API sin tirar el cron del servidor.
