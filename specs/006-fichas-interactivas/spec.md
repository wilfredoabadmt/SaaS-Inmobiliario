# Feature Specification: Fichas de propiedad interactivas por WhatsApp

**Feature Branch**: `006-fichas-interactivas`

**Created**: 2026-06-20

**Status**: Draft

**Input**: Convertir la ficha de propiedad en una **tarjeta real de WhatsApp** (foto + texto en un
solo mensaje) y, opcionalmente, con **botones** (agendar visita, hablar con asesor, más fotos).
Arregla el botón "Enviar ficha" del panel, que hoy no envía nada.

## Resumen

Cuando un asesor (o el agente de IA) quiere ofrecer una propiedad por WhatsApp, hoy la "ficha" o
**no llega** (el botón "Enviar ficha" del panel solo pinta una burbuja local, no manda nada) o llega
como **texto plano** (la del agente). Esta feature la convierte en una **tarjeta real**: un único
mensaje con la **foto principal** de la propiedad y, en el mismo mensaje, el texto (nombre, operación,
zona, precio, specs). Es **una sola tarjeta**, nunca dos mensajes sueltos.

Como segundo nivel, la tarjeta puede llevar **botones de acción** ("Agendar visita", "Hablar con
asesor", "Más fotos"); al tocarlos, el cliente dispara la acción correspondiente sin escribir nada:
se agenda la visita, se cede la conversación a un humano o se envían más fotos.

Aplica a los **dos emisores** de fichas: el **botón manual** del asesor y la **acción del agente**.
Reusa el inventario y las fotos existentes (no se suben imágenes nuevas), el agendado de visitas
(feature 004) y el handoff a humano (feature 005). Respeta el aislamiento multi-tenant, la
idempotencia de webhooks, la ventana de 24 h y el foco inmobiliario. Idioma: español (México).

## Clarifications

### Session 2026-06-20

- Q: Al tocar "Agendar visita" (el botón no trae fecha), ¿qué pasa? → A: el sistema **pide al cliente
  fecha/hora** y, al acordarla, **crea la visita** (reusa el agendado de 004). Si el agente está
  activo, conduce la conversación de fecha; si no, la conversación queda señalada para que el asesor
  cierre la cita.
- Q: ¿En cuáles tarjetas aparecen los botones? → A: en **ambas** — la que envía el asesor (botón
  manual) y la que envía el agente — por consistencia.
- Q: ¿Cuántas fotos adicionales envía "Más fotos"? → A: **hasta 5**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El asesor envía la ficha como tarjeta y de verdad llega (Priority: P1) 🎯 MVP

Como asesor, quiero que al presionar "Enviar ficha" en el panel de la bandeja, el cliente reciba por
WhatsApp una **tarjeta con la foto y los datos** de la propiedad, de modo que reciba algo atractivo y
no un texto seco (ni nada, como pasa hoy).

**Why this priority**: Es el bug visible que el dueño reportó: el botón no envía nada. Arreglarlo +
entregar la tarjeta es el valor mínimo e inmediato de la feature.

**Independent Test**: Con una propiedad con foto, presionar "Enviar ficha" en una conversación y
verificar que al cliente le llega **un solo mensaje** de WhatsApp con la **foto** arriba y el **texto**
(nombre, operación, zona, precio, specs) en el mismo mensaje, y que queda registrado en el hilo.

**Acceptance Scenarios**:

1. **Given** una conversación abierta y una propiedad con foto, **When** el asesor presiona "Enviar
   ficha", **Then** el cliente recibe **un único** mensaje de WhatsApp con la foto principal y el
   texto de la ficha en el mismo mensaje (no dos mensajes), y la tarjeta aparece en el hilo.
2. **Given** una propiedad **sin** foto, **When** el asesor presiona "Enviar ficha", **Then** se envía
   la ficha de **texto** (degradación), no falla ni queda sin enviar.
3. **Given** que el envío se realizó, **When** el asesor mira el hilo, **Then** la tarjeta queda como
   el último mensaje saliente (consistente con el resto de la bandeja).
4. **Given** una conversación **fuera** de la ventana de 24 h, **When** el asesor intenta enviar la
   ficha, **Then** el sistema lo comunica con claridad (no se puede enviar libre fuera de ventana;
   usar plantilla) en vez de fallar en silencio.

---

### User Story 2 - El agente envía la ficha como tarjeta (Priority: P1)

Como cliente, quiero que cuando el agente de IA me ofrezca una propiedad, me llegue la **tarjeta con
foto**, no un texto plano; como asesor, quiero consistencia entre lo que manda el agente y lo que
mando yo.

**Why this priority**: El agente ya envía la mejor ficha (feature 004) pero como texto. Subirla a
tarjeta con foto multiplica el impacto del diferencial, y reusa la misma capacidad de US1.

**Independent Test**: Con el agente activo y un cliente calificado con al menos un match con foto,
verificar que la ficha que envía el agente llega como **tarjeta** (foto + caption), marcada como
mensaje del agente, y queda en el hilo.

**Acceptance Scenarios**:

1. **Given** el agente decide enviar la mejor ficha (acción de 004) y la propiedad tiene foto,
   **When** la envía, **Then** el cliente recibe la **tarjeta** (foto + caption) en un solo mensaje,
   marcada como enviada por el agente.
2. **Given** que la mejor propiedad **no** tiene foto, **When** el agente la envía, **Then** degrada a
   la ficha de texto actual (no falla).
3. **Given** la anti-alucinación de 004, **When** el agente envía la tarjeta, **Then** solo usa una
   propiedad **real del tenant** que esté entre sus matches (sin inventar).

---

### User Story 3 - Botones de acción en la tarjeta (Priority: P2)

Como cliente, quiero poder **tocar un botón** en la ficha ("Agendar visita", "Hablar con asesor",
"Más fotos") y que pase algo, sin tener que escribir; como asesor, quiero que esas acciones queden
registradas y enrutadas solas.

**Why this priority**: Convierte la tarjeta en una herramienta de conversión (acción de un toque).
Depende de US1/US2 (la tarjeta) y reusa el agendado (004) y el handoff (005).

**Independent Test**: Enviar una tarjeta con botones, tocar cada botón desde el teléfono cliente y
verificar que: "Agendar visita" registra/inicia una visita, "Hablar con asesor" marca la conversación
para atención humana, y "Más fotos" envía fotos adicionales (o avisa si no hay).

**Acceptance Scenarios**:

1. **Given** una tarjeta enviada con botones, **When** el cliente toca **"Agendar visita"**, **Then**
   el sistema reconoce a qué propiedad corresponde, **pide al cliente la fecha/hora** y, al acordarla,
   registra la visita (reusa el agendado de 004) y la confirma. Con el agente activo, él conduce la
   conversación de fecha; con el agente apagado, la conversación queda señalada para que el asesor
   cierre la cita.
2. **Given** una tarjeta con botones, **When** el cliente toca **"Hablar con asesor"**, **Then** la
   conversación se marca para **atención humana** (handoff, reusa 005) y el agente deja de
   auto-responder.
3. **Given** una tarjeta con botones, **When** el cliente toca **"Más fotos"**, **Then** el sistema
   envía fotos adicionales de **esa** propiedad; si no hay más, lo comunica con amabilidad.
4. **Given** el mismo toque de botón recibido dos veces (reintento del webhook), **When** se procesa,
   **Then** la acción ocurre **una sola vez** (idempotencia).
5. **Given** una conversación con el agente **desactivado**, **When** el cliente toca un botón,
   **Then** la acción (agendar/handoff/más fotos) **igual** se ejecuta (es determinista del sistema,
   no depende del agente).

---

### Edge Cases

- **Propiedad sin foto**: la tarjeta degrada a ficha de texto; nunca se intenta enviar una imagen
  inexistente.
- **Fuera de la ventana de 24 h**: no se puede enviar tarjeta/botones de forma libre; aplica la regla
  de 005 (no enviar / avisar / ceder a humano). El asesor usa una plantilla aprobada si quiere
  reabrir.
- **Botón tocado pero el contexto se perdió** (la propiedad ya no está disponible o el mensaje es
  viejo): el sistema reconoce a qué propiedad apuntaba el botón; si ya no aplica, lo comunica con
  claridad en vez de fallar.
- **"Más fotos" sin fotos adicionales**: se informa que no hay más, sin error.
- **Caption muy largo**: el texto de la ficha se ajusta al límite del mensaje sin romper el envío.
- **Toque de botón duplicado / reintento**: una sola acción (idempotencia por identificador del
  mensaje entrante).
- **Tenant cruzado**: la foto y la propiedad de la tarjeta y de las acciones son siempre del tenant de
  la conversación.

## Requirements *(mandatory)*

### Functional Requirements

**Tarjeta de ficha (US1, US2)**

- **FR-001**: El sistema MUST poder enviar la ficha de una propiedad como **un único mensaje** de
  WhatsApp que incluye la **foto principal** de la propiedad y, en el mismo mensaje, el texto de la
  ficha (nombre, operación venta/renta, zona, precio en MXN, specs: recámaras/baños/superficie). No
  MUST enviarse como dos mensajes separados (imagen y texto por aparte).
- **FR-002**: El **botón manual** "Enviar ficha" del panel MUST **enviar realmente** la tarjeta al
  cliente por WhatsApp (hoy no envía) y registrarla como mensaje saliente en el hilo.
- **FR-003**: El **agente de IA** MUST enviar la ficha (su acción de "enviar la mejor ficha" de 004)
  como la **misma tarjeta** (foto + caption), no como texto plano, marcada como mensaje del agente.
- **FR-004**: Si la propiedad **no tiene foto**, el sistema MUST **degradar** a la ficha de texto
  actual (no fallar ni omitir el envío).
- **FR-005**: La foto y los datos de la tarjeta MUST ser **solo** de propiedades del tenant de la
  conversación (aislamiento multi-tenant).

**Botones interactivos (US3)**

- **FR-006**: El sistema MUST poder incluir en la tarjeta —tanto la enviada por el **asesor** como la
  del **agente**— hasta **3 botones** de acción: "Agendar visita", "Hablar con asesor" y "Más fotos".
- **FR-007**: Al recibir el **toque** de un botón (mensaje entrante de respuesta), el sistema MUST
  reconocer el evento y **a qué propiedad** corresponde el botón.
- **FR-008**: El botón **"Agendar visita"** MUST iniciar el agendado para esa propiedad: **pedir al
  cliente fecha/hora** y, al acordarla, **registrar la visita** (reutilizando el agendado de 004) y
  confirmarla. Con el agente activo, éste conduce la conversación de fecha; con el agente apagado, la
  conversación queda señalada para que el asesor cierre la cita.
- **FR-009**: El botón **"Hablar con asesor"** MUST hacer **handoff** a atención humana (reutilizando
  `needs_human` de la feature 005); el agente deja de auto-responder.
- **FR-010**: El botón **"Más fotos"** MUST enviar **hasta 5** fotos adicionales de la propiedad; si
  no hay más, MUST comunicarlo con claridad.
- **FR-011**: El procesamiento del toque de un botón MUST ser **idempotente**: un mismo evento
  (mismo identificador) no ejecuta la acción dos veces.
- **FR-012**: Las acciones de los botones MUST ejecutarse de forma **determinista del sistema**, con
  independencia de si el agente de IA está activo o no en la conversación.

**Transversales (ventana, UI, seguridad, dominio)**

- **FR-013**: El envío de la tarjeta y de los botones MUST respetar la **ventana de 24 h**: fuera de
  ella no se envía como mensaje libre; aplica la regla de la feature 005 (no enviar / avisar / ceder a
  humano), y el asesor puede usar una plantilla aprobada.
- **FR-014**: La bandeja MUST mostrar la **tarjeta** (foto + datos) en el hilo y distinguir las
  enviadas por el **agente** de las del asesor.
- **FR-015**: El sistema MUST mantener el **aislamiento multi-tenant** en todo el flujo (fotos,
  propiedades, visitas, acciones de botón).
- **FR-016**: Las credenciales y secretos (almacenamiento de objetos, WhatsApp) MUST gestionarse sin
  exponerse al cliente ni a logs.
- **FR-017**: Todo el texto MUST estar en **español (México)**; la feature MUST **no** generar
  contratos (foco inmobiliario, Principio VIII).

### Key Entities *(include if feature involves data)*

- **Foto de propiedad** *(existente)*: imágenes del inventario; tienen un orden. La **principal** es
  la de la tarjeta; las demás alimentan "Más fotos". Pertenecen al tenant.
- **Ficha-tarjeta** *(presentación, nueva)*: representación de la propiedad como mensaje de WhatsApp =
  foto principal + caption (nombre, operación, zona, precio, specs) + (opcional) botones de acción.
- **Mensaje** *(existente, extendido)*: además de texto/ficha, un saliente puede ser una **tarjeta de
  imagen** (con o sin botones); un **entrante** puede ser el **toque de un botón** (con referencia a
  la propiedad y a la acción).
- **Visita (muestra)** *(existente, 004)*: la puede crear el botón "Agendar visita".
- **Estado del agente por conversación** *(existente, 005)*: el botón "Hablar con asesor" lo pone en
  atención humana (handoff).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En los casos de prueba con foto, la ficha llega como **un solo mensaje** con foto +
  texto (no dos) el **100%** de las veces.
- **SC-002**: El botón manual "Enviar ficha" **entrega la tarjeta al cliente** el **100%** de las
  veces (vs **0%** hoy).
- **SC-003**: La ficha que envía el **agente** llega como **tarjeta** (foto + caption), no como texto,
  en el **100%** de los casos de prueba con foto.
- **SC-004**: En propiedades **sin** foto, el envío **degrada** a texto y **nunca falla** (0 envíos
  fallidos por falta de foto).
- **SC-005**: Al tocar cada botón, la acción correcta ocurre el **100%** de las veces en los casos de
  prueba: "Agendar visita" crea/inicia una visita, "Hablar con asesor" hace handoff, "Más fotos" envía
  más fotos (o avisa si no hay).
- **SC-006**: Un toque de botón repetido (reintento) produce **exactamente una** acción (0 acciones
  duplicadas).
- **SC-007**: **0** cruces de tenant: la tarjeta, las fotos y las acciones usan solo datos del tenant
  de la conversación.
- **SC-008**: La verificación automática (typecheck + lint + build) pasa en verde y el self-test de
  comportamiento (enviar una ficha al número de prueba y corroborar que llega como una tarjeta con
  foto + caption; tocar un botón y ver la acción) corrobora SC-001…SC-007.

## Assumptions

- **Foto principal** = la primera foto de la propiedad según su orden de presentación; "Más fotos" =
  las siguientes, **hasta 5** por envío.
- **Botones en ambos emisores**: tanto la tarjeta manual del asesor como la del agente llevan los
  botones (consistencia), por decisión del clarify.
- **Reuso de acciones**: "Agendar visita" usa el agendado de 004 (puede pedir/confirmar fecha si hace
  falta); "Hablar con asesor" usa el handoff de 005; "Más fotos" usa las fotos ya existentes en el
  almacenamiento de objetos (no se suben nuevas).
- **Fuera de ventana 24 h**: se respeta la regla de 005 (no se fuerza el envío libre); el asesor envía
  plantilla a mano si quiere reabrir.
- **Idempotencia**: el toque de botón entra como un mensaje entrante normal y se deduplica con el mismo
  mecanismo que el resto (identificador único del mensaje).
- **Constitución**: español MX, foco inmobiliario, sin contratos, aislamiento de tenant, secretos fuera
  del cliente/logs, modo claro.
- **Sprint cerrado** cuando el self-test corrobora que la ficha llega como tarjeta (foto + caption) y
  que los botones disparan su acción, además de la puerta de calidad automática.

## Dependencies

- **Feature 004 (agente + matching)**: la acción de "enviar la mejor ficha" (ahora como tarjeta) y el
  agendado de visitas que reusa el botón "Agendar visita".
- **Feature 005 (robustez del agente)**: el handoff a humano (`needs_human`) que reusa el botón
  "Hablar con asesor", y la regla de ventana de 24 h.
- **Feature 003 (diseño)**: la burbuja de ficha de propiedad en el hilo de la bandeja.
- **Inventario y fotos** (modelo de dominio existente): propiedades y sus fotos en el almacenamiento de
  objetos (interfaz S3 estándar); la bandeja y el panel de matching donde vive el botón "Enviar ficha".
- **WhatsApp Cloud API**: capacidad de enviar mensajes con imagen y mensajes interactivos con botones,
  y de recibir el evento de respuesta de un botón.

## Out of Scope (v1)

- **Carrusel deslizable / tarjetas de producto / catálogo de Meta Commerce**: el dueño explícitamente
  **no** quiere carrusel; queda fuera.
- **Subir imágenes nuevas**: se usan solo las fotos ya existentes del inventario.
- **Botones con más de 3 opciones** o menús de lista: v1 se limita a los 3 botones definidos.
- **Plantillas de marketing con imagen/botones** para fuera de la ventana de 24 h: el reenganche fuera
  de ventana sigue la regla de 005 (manual por plantilla), no se automatiza aquí.
