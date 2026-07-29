# Feature Specification: Robustez y modo híbrido confiable del agente de IA

**Feature Branch**: `005-robustez-agente`

**Created**: 2026-06-20

**Status**: Draft

**Input**: Cerrar los casos límite que la feature 004 declaró pero dejó abiertos, para que el agente
de IA sea confiable en producción y **nunca falle en silencio**: (1) ventana de servicio de 24 h,
(2) mensajes no textuales, (3) ráfaga/concurrencia de mensajes, (4) degradación visible cuando el
proveedor de IA falla.

## Resumen

La feature 004 dejó al agente de IA respondiendo bien en el **camino feliz**: el cliente escribe
**texto dentro de la ventana de 24 h**, el agente responde, califica, envía la mejor ficha, agenda
visita y hace handoff. Pero fuera de ese camino el agente **falla en silencio**: si el cliente
escribe pasadas 24 h, el envío de texto libre es rechazado por WhatsApp y nadie se entera; si el
cliente manda un **audio, imagen, ubicación, sticker o documento**, el agente no hace nada; si el
cliente manda **varios mensajes seguidos**, se disparan corridas solapadas que pueden producir
respuestas duplicadas o contradictorias; y si el **proveedor de IA falla**, el cliente queda sin
respuesta sin ninguna señal para el asesor.

Esta feature convierte al agente en **confiable**: en cada uno de esos casos límite el sistema toma
una acción explícita y observable (responder con una alternativa adecuada, o **ceder a un humano y
señalarlo en la bandeja**), de modo que **ninguna conversación atendida por IA quede muda sin que el
asesor lo sepa**. No agrega capacidades conversacionales nuevas; endurece las existentes.

Se mantiene el modo **híbrido, opt-in por conversación** y todas las reglas de 004 (español MX, no
inventar, no contratos, aislamiento de tenant, idempotencia por `wa_message_id`). El alcance es la
**robustez del agente**, no nuevas acciones de negocio.

## Clarifications

### Session 2026-06-20

- Q: Fuera de la ventana de 24 h, ¿qué hace el agente? → A: **Ceder a humano** con señal "fuera de
  ventana"; no envía texto libre ni auto-plantilla de reenganche (el asesor puede mandar una plantilla
  a mano). El auto-reenganche por plantilla queda fuera de v1.
- Q: ¿Cómo reacciona ante un mensaje no textual (audio/imagen/ubicación)? → A: **Interim en 005**: el
  agente pide amablemente que lo escriban por texto y señala el mensaje como "no interpretable por la
  IA" (motivo visible en bandeja). El **soporte real de audio e imagen** (transcripción + visión) se
  aborda en una **feature dedicada de agente multimodal** (próxima), no en 005.
- Q: ¿Cómo coalescer una ráfaga de mensajes? → A: **Espera corta de coalescencia** (unos segundos)
  para agrupar los mensajes consecutivos del cliente y responder **una sola vez** considerando todos.
- Q: ¿Cómo se distingue en la bandeja el motivo de "requiere atención humana"? → A: Una **etiqueta/
  señal distinta por motivo** (pidió humano / fuera de 24 h / mensaje no interpretable / falló la IA).
- Q: El soporte multimodal (audio + imagen), ¿en 005 o aparte? → A: En una **feature dedicada**
  (agente multimodal), no en 005; 005 mantiene solo el fallback elegante para no-texto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El agente no falla en silencio fuera de la ventana de 24 h (Priority: P1)

Como asesor, quiero que cuando un cliente escriba pasadas las 24 h de su último mensaje el agente
**no intente** mandar texto libre (que WhatsApp rechaza) y en cambio me **ceda la conversación con
una señal clara**, de modo que ese cliente nunca quede sin respuesta de forma invisible.

**Why this priority**: Es el fallo silencioso más grave: hoy el agente intenta enviar texto fuera de
ventana, WhatsApp lo rechaza y el error se traga; el cliente no recibe nada y el asesor no se entera.
Rompe la promesa básica del modo híbrido (la IA atiende o el humano lo hace, pero alguien atiende).

**Independent Test**: En una conversación con el agente activo cuyo último mensaje del cliente fue
hace más de 24 h, hacer que llegue un mensaje nuevo y verificar que el agente **no** envía texto
libre, que la conversación se marca como "requiere atención humana" con la señal de "fuera de ventana
24 h", y que el evento queda registrado (no se reporta ninguna respuesta como enviada).

**Acceptance Scenarios**:

1. **Given** una conversación con agente activo y el último mensaje entrante del cliente con más de
   24 h de antigüedad, **When** llega un mensaje nuevo del cliente, **Then** el agente **no** envía
   respuesta de texto libre y la conversación se marca para atención humana con una señal visible de
   "fuera de la ventana de 24 h".
2. **Given** una conversación con agente activo dentro de la ventana de 24 h, **When** llega un
   mensaje, **Then** el agente responde con normalidad (comportamiento de 004 sin cambios).
3. **Given** un caso fuera de ventana, **When** el sistema lo maneja, **Then** **no** se registra
   ninguna respuesta del agente como "enviada" (no hay falsos positivos de envío).
4. **Given** una conversación marcada por estar fuera de ventana, **When** el asesor la atiende y el
   cliente vuelve a escribir dentro de una nueva ventana, **Then** el asesor puede reanudar el agente
   (como en el handoff de 004) y el agente vuelve a operar normalmente.

---

### User Story 2 - El agente atiende los mensajes que no puede interpretar (Priority: P1)

Como cliente, si mando una nota de voz, una foto o mi ubicación, quiero recibir alguna respuesta y no
silencio; como asesor, quiero que el agente reconozca que entró un mensaje que la IA no procesa y lo
**escale o pida texto**, de modo que esos mensajes no caigan en un vacío.

**Why this priority**: Hoy un mensaje no textual **no dispara** al agente: el cliente queda en
silencio y el asesor no recibe ninguna señal. Es un fallo silencioso frecuente (los clientes mandan
audios) y muy visible para el cliente final.

**Independent Test**: En una conversación con el agente activo, hacer que llegue un mensaje de audio
(y por separado uno de imagen y uno de ubicación) y verificar que el sistema responde de forma
cortés pidiendo que lo escriban por texto **o** cede a un humano, y que la bandeja señala que hay un
mensaje que la IA no pudo interpretar.

**Acceptance Scenarios**:

1. **Given** una conversación con agente activo, **When** llega un mensaje de audio/imagen/ubicación/
   sticker/documento, **Then** el sistema **no** lo ignora: responde en español MX pidiendo
   amablemente que lo escriban por texto y **señala el mensaje como "no interpretable por la IA"** en
   la bandeja; cede a atención humana si el cliente insiste con no-texto o pide humano. (El soporte
   real de audio/imagen es una feature dedicada de agente multimodal, fuera de 005.)
2. **Given** que el cliente manda un audio y luego (en otra entrada) describe lo mismo por texto,
   **When** llega el texto, **Then** el agente procesa el texto con normalidad (US2 no bloquea el
   flujo de texto posterior).
3. **Given** que la respuesta a un no-texto requiere enviar texto libre, **When** la conversación
   está **fuera** de la ventana de 24 h, **Then** aplica la regla de US1 (no envía texto libre; marca
   para humano).
4. **Given** un mensaje no textual fuera de alcance, **When** el sistema decide pedir texto, **Then**
   no inventa una interpretación del contenido (no "adivina" qué decía el audio o la foto).

---

### User Story 3 - Una sola respuesta coherente ante una ráfaga de mensajes (Priority: P2)

Como cliente, suelo mandar varios mensajes cortos seguidos; quiero **una** respuesta que considere
todo lo que dije y no varias respuestas encimadas o contradictorias. Como asesor, no quiero que el
agente "hable solo" varias veces por una sola idea partida en pedazos.

**Why this priority**: Hoy cada mensaje entrante dispara una corrida independiente del agente; una
ráfaga produce respuestas solapadas, duplicadas o contradictorias y posibles condiciones de carrera
al escribir requisitos/visitas. Degrada la calidad percibida del agente, aunque no deja al cliente
sin respuesta.

**Independent Test**: En una conversación con el agente activo, enviar 3 mensajes del cliente en
rápida sucesión (p. ej. "hola" / "busco depto en Polanco" / "2 recámaras, hasta 28 mil") y verificar
que el agente produce **una** respuesta coherente que considera los tres, sin respuestas solapadas ni
contradictorias, y sin requisitos escritos de forma inconsistente.

**Acceptance Scenarios**:

1. **Given** una conversación con agente activo, **When** el cliente envía varios mensajes en una
   ventana corta de tiempo, **Then** el agente responde una vez de forma coherente considerando todos
   los mensajes acumulados (no una respuesta por mensaje).
2. **Given** una ráfaga, **When** el agente actualiza los requisitos del cliente, **Then** el
   resultado refleja la combinación de los mensajes sin perder ni pisar datos por condiciones de
   carrera.
3. **Given** la idempotencia existente por identificador de mensaje, **When** ocurre la ráfaga,
   **Then** se preserva (un reintento del mismo mensaje sigue sin duplicar efectos) y no se introduce
   ningún doble procesamiento nuevo.
4. **Given** dos conversaciones distintas con ráfagas simultáneas, **When** se procesan, **Then** no
   se bloquean ni se mezclan entre sí (el ordenamiento es por conversación, con aislamiento de
   tenant).

---

### User Story 4 - Degradación visible cuando el proveedor de IA falla (Priority: P2)

Como asesor, quiero que cuando el proveedor de IA falle o tarde demasiado, la conversación afectada
me lo **señale** para tomarla yo, en lugar de que el cliente quede sin respuesta y yo sin enterarme.

**Why this priority**: Hoy un fallo del proveedor de IA solo deja un registro técnico; el cliente
queda sin respuesta de forma invisible. Convertir el fallo en una señal accionable cierra el último
modo de "fallo en silencio".

**Independent Test**: Forzar una condición de fallo del proveedor de IA (timeout / error) en una
conversación con el agente activo y verificar que la bandeja muestra que la IA no pudo responder esa
conversación, que **no** se marca ninguna respuesta como enviada, y que la bandeja sigue operativa
para el resto de conversaciones.

**Acceptance Scenarios**:

1. **Given** una conversación con agente activo, **When** el proveedor de IA falla o agota el tiempo
   de espera al procesar un mensaje, **Then** la conversación se señala en la bandeja como "la IA no
   pudo responder" (requiere atención humana) y **no** se envía ni se registra respuesta alguna.
2. **Given** un fallo del proveedor de IA en una conversación, **When** el asesor mira la bandeja,
   **Then** el resto de la bandeja sigue funcionando con normalidad (el fallo no la rompe).
3. **Given** una conversación señalada por fallo de IA, **When** el asesor decide, **Then** puede
   atenderla a mano y/o reanudar el agente (mismo control de reanudación del handoff de 004).
4. **Given** cualquier fallo del proveedor de IA, **When** se registra el evento, **Then** **no** se
   exponen secretos del proveedor (clave/credenciales) en logs ni mensajes (Principio I).

---

### Edge Cases

- **Justo en el límite de 24 h**: el mensaje del cliente cae muy cerca del borde de la ventana. El
  sistema decide con un criterio único y consistente (dentro/fuera) y, ante la duda, se comporta como
  "fuera" (conservador: no arriesga un envío rechazado).
- **Mensaje mixto** (texto + adjunto en el mismo mensaje, p. ej. una foto con pie de texto): se trata
  el componente de texto como texto (US2 aplica solo cuando no hay texto utilizable).
- **Ráfaga que cruza la ventana de 24 h**: si durante la ráfaga la conversación queda fuera de
  ventana, prevalece la regla de US1 (no texto libre, marca para humano).
- **Ráfaga que incluye un no-texto**: la respuesta coherente reconoce el no-texto según US2 (pide
  texto o escala) sin ignorar los mensajes de texto de la misma ráfaga.
- **Fallo de IA en medio de una acción** (p. ej. tras calificar pero antes de responder): no se deja
  un estado a medias que reporte una respuesta inexistente; la conversación se señala como no
  respondida por IA.
- **Cliente pide humano dentro de un no-texto o una ráfaga**: el handoff explícito de 004 sigue
  teniendo prioridad (si el sistema puede detectarlo, cede a humano).
- **Agente desactivado**: ninguno de estos comportamientos se dispara con el agente apagado (0
  respuestas automáticas, igual que 004).

## Requirements *(mandatory)*

### Functional Requirements

**Ventana de 24 h (US1)**

- **FR-001**: Antes de que el agente envíe una respuesta de **texto libre**, el sistema MUST
  determinar si la conversación está **dentro** de la ventana de servicio de 24 h (según el último
  mensaje entrante del cliente).
- **FR-002**: Si la conversación está **fuera** de la ventana de 24 h, el sistema MUST **no** enviar
  texto libre por parte del agente; en su lugar MUST marcar la conversación para **atención humana**
  con una señal distinguible de "fuera de la ventana de 24 h".
- **FR-003**: El sistema MUST **no** registrar como "enviada" ninguna respuesta que no haya salido
  por estar fuera de ventana (sin falsos positivos de envío) — consistente con FR-019 de 004.

**Mensajes no textuales (US2)**

- **FR-004**: Con el agente activo, ante un mensaje entrante **no textual** (audio, imagen, video,
  ubicación, sticker, documento, contacto), el sistema MUST tomar una acción explícita y observable:
  responder en español MX pidiendo amablemente que el cliente lo escriba por texto **y** señalar el
  mensaje como "no interpretable por la IA"; MUST ceder a atención humana si el cliente insiste con
  no-texto o pide humano; en ningún caso MUST quedarse sin acción. (El **soporte real** de audio e
  imagen —transcripción y visión— se aborda en una feature dedicada de agente multimodal, fuera del
  alcance de 005.)
- **FR-005**: El sistema MUST señalar en la bandeja que entró un mensaje que la IA **no pudo
  interpretar**, de modo que el asesor pueda intervenir.
- **FR-006**: El agente MUST **no inventar** el contenido de un mensaje no textual (no adivinar lo que
  decía un audio, una imagen o una ubicación) — consistente con FR-008 de 004.
- **FR-007**: Un mensaje **textual** posterior MUST procesarse con normalidad aunque antes haya
  entrado un no-texto (US2 no bloquea el flujo de texto).

**Ráfaga / concurrencia (US3)**

- **FR-008**: Cuando un cliente envía **varios mensajes en una ventana corta de tiempo**, el sistema
  MUST producir **una** respuesta coherente que considere los mensajes acumulados, en lugar de una
  respuesta por cada mensaje, mediante una **espera corta de coalescencia** (del orden de unos
  segundos) que agrupa los mensajes consecutivos del cliente antes de que el agente responda.
- **FR-009**: El procesamiento del agente por conversación MUST evitar **condiciones de carrera** al
  actualizar requisitos del cliente y al registrar acciones (visitas, fichas): el resultado de una
  ráfaga MUST ser consistente (sin datos pisados ni duplicados).
- **FR-010**: La robustez ante ráfaga MUST **preservar la idempotencia existente** por identificador
  único de mensaje (`wa_message_id`): un reintento del webhook sigue sin duplicar efectos.
- **FR-011**: El ordenamiento/serialización del procesamiento MUST ser **por conversación** y
  respetar el aislamiento multi-tenant: ráfagas de conversaciones distintas no se bloquean ni se
  mezclan.

**Degradación visible (US4)**

- **FR-012**: Si el proveedor de IA **falla o agota el tiempo de espera** al procesar un mensaje, el
  sistema MUST señalar esa conversación en la bandeja como "la IA no pudo responder" (requiere
  atención humana) y MUST **no** enviar ni registrar respuesta alguna.
- **FR-013**: Un fallo del proveedor de IA en una conversación MUST **no** romper la bandeja ni
  afectar el resto de conversaciones (degradación con gracia, consistente con FR-019 de 004).
- **FR-014**: Los registros de fallo del proveedor de IA MUST **no** exponer secretos (clave/
  credenciales del proveedor) ni datos de otro tenant (Principios I y III).

**Transversales (modo híbrido, reanudación, señales)**

- **FR-015**: Todas las señales nuevas de la bandeja (fuera de ventana, no-texto sin interpretar,
  fallo de IA) MUST distinguirse visiblemente como conversaciones que **requieren atención humana**,
  reutilizando el patrón de señal de handoff de 004 (FR-014 de 004) **con una etiqueta/señal distinta
  por motivo** (pidió humano, fuera de ventana 24 h, mensaje no interpretable, falló la IA) para que
  el asesor sepa de un vistazo qué pasó, y MUST poder **reanudarse** (el asesor reactiva el agente)
  con el mismo control de reanudación.
- **FR-016**: Ninguno de estos comportamientos MUST dispararse con el agente **desactivado** (0
  respuestas automáticas; consistente con SC-007 de 004).
- **FR-017**: Todo texto que el agente envíe en estos casos MUST estar en **español (México)**, con
  tono amable y profesional (consistente con FR-020 de 004).

### Key Entities *(include if feature involves data)*

- **Estado del agente por conversación** *(existente, extendido)*: además de "activo (opt-in)" y
  "requiere atención humana", distingue el **motivo** por el que requiere atención humana (handoff a
  petición, fuera de ventana 24 h, mensaje no interpretable, fallo de IA), para que la bandeja lo
  comunique y el asesor sepa qué pasó.
- **Mensaje entrante** *(existente, extendido en lectura)*: además de dirección/estado, el sistema
  distingue su **tipo** (texto vs no-texto) para decidir el comportamiento del agente.
- **Ventana de servicio de 24 h** *(concepto existente)*: periodo, contado desde el último mensaje
  entrante del cliente, dentro del cual el agente puede enviar texto libre; fuera de él aplica la
  regla de no-texto-libre.
- **Conversación** *(existente)*: el ámbito de serialización del procesamiento del agente (una ráfaga
  se resuelve por conversación) y el portador de las señales de atención humana.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En los casos de prueba **fuera de la ventana de 24 h**, el agente envía texto libre el
  **0%** de las veces y marca la conversación para atención humana con la señal de "fuera de ventana"
  el **100%** de las veces.
- **SC-002**: En los casos de prueba de **mensaje no textual** (audio, imagen, ubicación), el agente
  toma una acción observable (pide texto o cede a humano) el **100%** de las veces; **0** mensajes no
  textuales quedan sin respuesta ni señal.
- **SC-003**: Ante una **ráfaga** de mensajes del cliente (p. ej. 3 en rápida sucesión), el agente
  produce **una** respuesta coherente que refleja todos los mensajes, con **0** respuestas
  duplicadas o contradictorias en los casos de prueba.
- **SC-004**: Ante un **fallo forzado del proveedor de IA**, el **100%** de las conversaciones
  afectadas quedan señaladas en la bandeja como "la IA no pudo responder" y **0** respuestas se
  reportan como enviadas; el resto de la bandeja permanece operativa.
- **SC-005**: Se mantiene la **idempotencia**: un mensaje entrante repetido (reintento) produce
  exactamente **una** (o ninguna, si aplica una regla de no-respuesta) acción del agente — **0**
  efectos duplicados — incluso bajo ráfaga.
- **SC-006**: **0** fugas de secretos del proveedor de IA en logs o mensajes en todos los casos de
  prueba (incluidos los de fallo).
- **SC-007**: Toda conversación señalada por estos casos (fuera de ventana, no-texto, fallo de IA)
  puede **reanudarse** por el asesor el **100%** de las veces, devolviendo el control al agente.
- **SC-008**: La verificación automática (typecheck + lint + build) pasa en verde y la verificación
  de comportamiento (self-test conversando como cliente por WhatsApp) corrobora SC-001…SC-007.

## Assumptions

- **Reutiliza 004**: esta feature endurece el agente existente (su cerebro conversacional, el
  matching, el envío saliente, el estado del agente por conversación y la señal de handoff). No
  cambia los modelos de IA ni el modo opt-in.
- **Fuera de ventana 24 h → atención humana (decisión por defecto)**: cuando la conversación está
  fuera de la ventana, el comportamiento por defecto es **no** enviar texto libre y **ceder a un
  humano con señal visible**. El **reenganche automático por plantilla aprobada** (que el agente
  elija y mande una plantilla por sí solo) queda **fuera del alcance de v1** y se anota como candidato
  futuro: requiere una plantilla de reenganche aprobada y lógica de selección que exceden la
  robustez mínima. El asesor sí puede enviar una plantilla a mano (capacidad ya existente de 001).
- **Ventana de 24 h**: se cuenta desde el último mensaje **entrante** del cliente; ante un caso de
  borde se resuelve de forma conservadora como "fuera de ventana".
- **No-texto en v1 (interim)**: en 005 el agente **no** interpreta audio/imagen/ubicación por IA (no
  transcribe ni describe); solo reconoce que no es texto, pide texto y señala el mensaje como no
  interpretable (o escala). El **soporte real** de audio e imagen (transcripción + visión) se hace en
  una **feature dedicada de agente multimodal** (próxima), que reemplazará este fallback.
- **Ráfaga**: "ventana corta de tiempo" se interpreta como una agrupación razonable de mensajes
  consecutivos del mismo cliente; el detalle (cómo se agrupan/serializan) se define en el plan. El
  inventario y volumen de una agencia chica hacen viable una serialización por conversación.
- **Señales en la bandeja**: se reutiliza el patrón visual de "requiere atención humana" de 004,
  diferenciando el motivo; no se introduce un sistema de notificaciones nuevo (correo/push) en v1.
- **Constitución**: se mantienen español MX, foco inmobiliario, no generar contratos, aislamiento de
  tenant, idempotencia de webhooks, cifrado/secretos fuera del cliente y de logs, modo claro.
- **Sprint cerrado** cuando el self-test (conversación como cliente vía número personal ↔ número de
  prueba, respetando el guardrail de allowlist de Evolution) corrobora los cuatro comportamientos
  nuevos (fuera de 24 h, no-texto, ráfaga, fallo de IA) además de la puerta de calidad automática.

## Dependencies

- **Feature 004 (agente de IA + matching)**: esta feature extiende su flujo (disparo desde el webhook,
  loop del agente, envío saliente, estado del agente por conversación, señal de handoff).
- **Feature 003 (sistema de diseño)**: la bandeja y el patrón de señal "requiere atención humana"
  donde se muestran los nuevos motivos.
- **Features 001 (bandeja + WhatsApp Cloud API)**: ventana de 24 h, envío de texto/plantilla, webhooks
  idempotentes (dedup por `wa_message_id`), tipos de mensaje entrante del webhook.
- **Proveedor de IA (OpenRouter)**: cuyo fallo/timeout esta feature vuelve visible y manejable.

## Out of Scope (v1)

- **Reenganche proactivo / seguimiento programado**: recontactar automáticamente al cliente que dejó
  de responder (requiere planificación temporal y plantillas) — candidato a una feature futura.
- **Auto-envío de plantilla de reenganche por el agente** fuera de la ventana de 24 h (ver
  Assumptions).
- **Interpretación de multimedia por IA** (transcripción de audio, lectura de imágenes, resolución de
  ubicación) — se aborda en una **feature dedicada de agente multimodal** (próxima), no en 005. En
  005 solo queda el fallback elegante (pedir texto + señal de no interpretable).
- **Notificaciones externas** al asesor (correo/push) ante una señal de atención humana.
