# Feature Specification: Movimiento Agéntico del Pipeline por IA (017-ai-pipeline-progression)

**Feature Branch**: `017-ai-pipeline-progression`  
**Created**: 2026-09-17  
**Status**: In Progress  

**Input**: Implementar el avance inteligente y automático de los tratos en el embudo de ventas según las interacciones del chat y el análisis del Agente de IA, respetando de forma estricta la regla de avance hacia adelante (*forward-only*).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Avance Automático por Primer Contacto (Priority: P1)

Cuando un cliente escribe por primera vez, el sistema crea su trato en la etapa `Nuevo`.
- En cuanto un asesor humano o el Agente de IA envía la primera respuesta saliente al cliente, el sistema avanza automáticamente el trato a la etapa `Contactado`.

**Why this priority**: Refleja el estado real del lead sin obligar al asesor a mover manualmente la tarjeta tras responder el primer mensaje.

**Independent Test**: Enviar mensaje entrante de prueba $\rightarrow$ la tarjeta está en `Nuevo`. Responder desde la bandeja $\rightarrow$ la tarjeta avanza a `Contactado`.

---

### User Story 2 - Calificación Automática al Capturar Requisitos (Priority: P1)

Cuando el cliente comparte sus requerimientos (presupuesto, zona, recámaras, tipo de operación) y el Agente de IA los extrae en `client_requirements`:
- El trato del cliente avanza automáticamente a la etapa `Calificado`.

**Why this priority**: Un lead con presupuesto y zona definida ya no es un simple contacto, es un prospecto perfilado para matching.

**Independent Test**: El cliente responde "Busco departamento en renta en Polanco de 25 mil a 30 mil pesos"; el agente procesa el turno y la tarjeta avanza automáticamente a `Calificado`.

---

### User Story 3 - Acción `advance_stage` por el Agente de IA (Priority: P1)

El Agente de IA puede emitir la acción `advance_stage` (`stage`: "documentacion" | "en_negociacion") cuando el cliente exprese explícitamente su deseo de apartar el inmueble, enviar papelería o negociar una oferta.
- La automatización ejecuta `advanceStageForward`, verificando que la etapa destino esté adelante en el orden del Kanban. Si la etapa actual ya está más avanzada, no realiza ningún cambio.

**Why this priority**: Mantiene el CRM sincronizado en tiempo real con el estado de la negociación sin fricción humana.

**Independent Test**: Provocar que el modelo emita `advance_stage` hacia `documentacion`; verificar que el trato avanza; verificar que un intento de retroceder a `nuevo` es ignorado.
