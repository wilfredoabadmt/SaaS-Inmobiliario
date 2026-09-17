# Feature Specification: Transcripción Automática de Notas de Voz de WhatsApp (018-voice-notes-stt)

**Feature Branch**: `018-voice-notes-stt`  
**Created**: 2026-09-17  
**Status**: In Progress  

**Input**: Permitir que el sistema procese notas de voz y audios enviados por clientes en WhatsApp, transcribiendo su contenido a texto para su lectura en la bandeja e integración directa con el Agente de IA.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transcripción de Audio en la Bandeja (Priority: P1)

Cuando un cliente envía una nota de voz por WhatsApp:
1. El sistema recibe el webhook de Meta con `type === 'audio'`.
2. Descarga el audio desde Meta Cloud API mediante el `media_id`.
3. Transcribe el audio con IA a texto en español.
4. Actualiza el mensaje en la base de datos: `body = "[Nota de voz]: <transcripción>"`.
5. El asesor puede leer el mensaje en el hilo del chat en `/inbox` inmediatamente.

**Why this priority**: Acelera la atención del asesor al evitar la necesidad de escuchar audios largos en horarios de oficina o reuniones.

**Independent Test**: Enviar un webhook simulando nota de voz $\rightarrow$ verificar que el mensaje se actualiza con la transcripción en la base de datos.

---

### User Story 2 - El Agente de IA Responde a Notas de Voz (Priority: P1)

Si la conversación tiene el Agente de IA habilitado (`aiEnabled: true` y sin handoff):
1. Tras completar la transcripción, el sistema programa el turno del agente (`scheduleAgentRun`).
2. El Agente de IA analiza el texto transcrito, extrae los requisitos del cliente (zona, presupuesto, recámaras) y responde con un mensaje de texto natural por WhatsApp.

**Why this priority**: Elimina la fricción de pedirle al cliente que escriba cuando el 70%+ de los prospectos inmobiliarios prefieren hablar por notas de voz.

**Independent Test**: Simular un audio de un cliente diciendo "Quiero una casa en venta en Querétaro de 3 millones"; comprobar que el agente extrae los requisitos y responde proponiendo opciones.

---

## Edge Cases

1. **Audio inaudible o vacío**:
   - Si la transcripción está vacía o el archivo está dañado, el sistema degrada al comportamiento previo pidiendo texto (`sendAgentAskForText`).
2. **Límite de duración**:
   - Audios mayores a 20 MB o más de 5 minutos se omiten para evitar timeouts y costos excesivos.
