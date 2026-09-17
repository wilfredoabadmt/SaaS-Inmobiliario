# Feature Specification: Métricas y Datos Reales en Tablero de Inicio (014-dashboard-metrics)

**Feature Branch**: `014-dashboard-metrics`  
**Created**: 2026-09-17  
**Status**: In Progress  

**Input**: Conectar la pantalla `/inicio` con datos reales de la base de datos de la agencia, eliminando definitivamente las dependencias de datos estáticos simulados (`SAMPLE_KPIS`, `SAMPLE_ACTIVITY`, `SAMPLE_UPCOMING_VISITS`, `SlaBanner count={4}`).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - KPIs y Métricas Reales de la Agencia (Priority: P1)

Al entrar a `/inicio`, el usuario ve tarjetas de KPIs calculadas en tiempo real desde la base de datos con scope estricto de su organización:
1. **Leads nuevos**: Total de clientes creados en los últimos 7 días.
2. **Conversaciones activas**: Total de conversaciones con actividad en los últimos 7 días.
3. **Visitas esta semana**: Visitas (`showing`) programadas o realizadas en la semana en curso.
4. **Cierres del mes**: Candidaturas en etapa de cierre ganado (`kind='won'`) en el mes actual.
5. **Sin responder**: Conversaciones con último mensaje entrante sin contestar.

**Why this priority**: Es la pantalla de inicio del SaaS. Mostrar métricas reales es la promesa central del tablero comercial.

**Independent Test**: Crear un cliente nuevo, agendar una visita y verificar que los contadores de `/inicio` se incrementan de inmediato.

---

### User Story 2 - Banner Dinámico de Alerta SLA (Priority: P1)

El banner superior alerta sobre conversaciones que tienen un mensaje entrante (`inbound`) sin respuesta de un asesor por más de 30 minutos.
- Si hay 1 o más: Muestra `"{N} leads sin responder hace más de 30 min"` y botón "Revisar" que enlaza a `/inbox`.
- Si hay 0: Muestra estado al día `"¡Excelente! No hay mensajes pendientes de respuesta"`.

**Why this priority**: La velocidad de respuesta en WhatsApp es el principal factor de conversión de una inmobiliaria; el banner previene la pérdida de clientes.

**Independent Test**: Simular un mensaje entrante con fecha anterior a 30 minutos; verificar que el banner muestra la alerta. Responder desde la bandeja; verificar que el banner desaparece o muestra 0.

---

### User Story 3 - Próximas Visitas Reales (Priority: P1)

La columna "Próximas visitas" lista las citas reales de la tabla `showing` en estado `agendada` posteriores a la hora actual (`scheduledAt >= now()`), ordenadas ascendentemente:
- Muestra bloque de fecha (mes abreviado, número de día), hora formateada en la zona horaria del asesor/agencia, nombre del cliente, título de la propiedad con punto de operación (renta/venta) y asesor asignado.
- Si no hay visitas agendadas, muestra un estado vacío claro y un enlace para ver el calendario completo en `/showings`.

**Why this priority**: Evita que los asesores pierdan citas y centraliza la agenda del día al iniciar la jornada.

**Independent Test**: Agendar una visita para el día de mañana desde `/showings`; recargar `/inicio` y verificar que la tarjeta aparece en la lista con los datos exactos.

---

### User Story 4 - Feed de Actividad Reciente del Equipo (Priority: P2)

La columna de actividad reciente muestra los últimos movimientos relevantes de la agencia (visitas agendadas, mensajes entrantes, tratos movidos), con el nombre del cliente/actor, la descripción de la acción y el tiempo relativo transcurrido.

**Why this priority**: Da visibilidad operativa instantánea de lo que está ocurriendo en la agencia.

**Independent Test**: Realizar una acción en el sistema y verificar que aparece en el feed de actividad de `/inicio`.
