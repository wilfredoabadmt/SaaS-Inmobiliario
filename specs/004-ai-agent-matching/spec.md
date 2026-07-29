# Feature Specification: Agente de IA conversacional + matching propiedad↔cliente

**Feature Branch**: `004-ai-agent-matching`

**Created**: 2026-06-19

**Status**: Draft

**Input**: Agente de IA que responde WhatsApp (cerebro `deepseek/deepseek-v4-flash`) + matching
propiedad↔cliente con IA (`deepseek/deepseek-v4-pro`). Híbrido, opt-in por conversación; el
agente califica, responde dudas del inventario, envía la mejor ficha y agenda visita.

## Resumen

El núcleo diferencial de Inmox: convertir la bandeja de WhatsApp en un **asesor inmobiliario
con IA**. Cuando un cliente escribe, un agente de IA (1) **califica** al cliente extrayendo sus
requisitos de la conversación, (2) **responde dudas** sobre el inventario real del tenant sin
inventar datos, (3) calcula en vivo el **matching** propiedad↔cliente (ranking con % de afinidad,
razones y explicación), (4) **envía la ficha** de la propiedad que mejor empata, y (5) **propone y
agenda visitas**. Opera en modo **híbrido** (responde y califica solo, pero **pasa a un humano** en
el cierre, temas sensibles o cuando el cliente lo pide) y se activa **opt-in por conversación** (el
asesor enciende/apaga el agente). El matching real reemplaza los datos de muestra del panel
"Matching en vivo" introducido en la feature 003.

Idioma: español (México). Tono amable, profesional y efectivo. El agente **nunca inventa**
propiedades/precios/datos y **no genera ni firma contratos** (constitución, Principio VIII). Respeta
la ventana de servicio de 24 h de WhatsApp y el aislamiento multi-tenant.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Requisitos del cliente + matching real con IA (Priority: P1)

Como asesor, quiero que el sistema capture lo que busca cada cliente y me muestre, en vivo, las
propiedades de mi inventario que mejor le empatan (con un % de afinidad, razones y una explicación),
de modo que sepa al instante qué ofrecerle. El cliente diferenciador del producto.

**Why this priority**: El matching propiedad↔cliente es la oferta diferencial de Inmox. Sin
requisitos del cliente + ranking real, el panel "Matching en vivo" (feature 003) sigue vacío. Es la
base que habilitan las demás historias (el agente envía "la mejor ficha" usando este ranking).

**Independent Test**: Capturar (manual o por IA) los requisitos de un cliente y verificar que el
panel de matching lista las propiedades del inventario rankeadas por afinidad, con % coherente,
razones cumple/no-cumple y explicación; cambiar un requisito cambia el ranking.

**Acceptance Scenarios**:

1. **Given** un cliente con requisitos (operación, presupuesto, zona, tipo, recámaras, baños),
   **When** se abre su conversación, **Then** el panel "Matching en vivo" muestra las propiedades del
   inventario del tenant rankeadas por % de afinidad (mayor primero), cada una con razones
   (cumple/no cumple) y una explicación breve.
2. **Given** el ranking, **When** una propiedad cumple la operación, el presupuesto y la zona,
   **Then** su % es mayor que el de una que solo cumple algunas; el % refleja qué tan bien empata.
3. **Given** una conversación sin requisitos aún, **When** se abre, **Then** el panel indica que
   faltan requisitos (no muestra un ranking inventado).
4. **Given** que el inventario no tiene ninguna propiedad que cumpla la operación pedida, **When** se
   calcula el matching, **Then** el panel lo comunica con claridad (sin forzar matches irrelevantes).
5. **Given** requisitos de un cliente del tenant A, **When** se calcula el matching, **Then** solo se
   consideran propiedades del tenant A (aislamiento).

---

### User Story 2 - El agente de IA responde y califica (híbrido, opt-in) (Priority: P1)

Como asesor, quiero poder **activar un agente de IA** en una conversación para que responda a los
clientes de forma amable y efectiva y, de paso, **califique** al cliente (extraiga sus requisitos de
lo que va diciendo), de modo que no tenga que contestar cada mensaje ni capturar datos a mano.

**Why this priority**: Es la otra mitad del núcleo: automatizar la atención y la calificación. Junto
con US1 entrega el MVP del diferencial (atención con IA que ya hace matching).

**Independent Test**: Activar el agente en una conversación, escribir como cliente ("busco depto en
renta en Polanco, 2 recámaras, hasta 28 mil") y verificar que el agente responde con sentido y que
los requisitos del cliente quedan capturados (operación, zona, tipo, recámaras, presupuesto).

**Acceptance Scenarios**:

1. **Given** una conversación con el agente **activado** (opt-in), **When** entra un mensaje del
   cliente, **Then** el agente genera una respuesta en español MX, amable y pertinente, y la envía por
   WhatsApp dentro de la ventana de 24 h.
2. **Given** un mensaje donde el cliente expresa lo que busca, **When** el agente lo procesa, **Then**
   extrae y guarda/actualiza los requisitos del cliente (operación, presupuesto, zona, tipo,
   recámaras, baños) que alimentan el matching (US1).
3. **Given** una conversación con el agente **desactivado**, **When** entra un mensaje, **Then** el
   agente **no** responde automáticamente (el asesor atiende a mano).
4. **Given** el asesor, **When** ve la conversación, **Then** puede **activar o desactivar** el agente
   con un control claro (toggle por conversación) y distingue qué mensajes los envió el agente.
5. **Given** un mensaje fuera del alcance o sin datos suficientes, **When** el agente responde,
   **Then** pide la información que falta de forma natural en vez de inventar una respuesta.
6. **Given** el mismo mensaje entrante recibido dos veces (reintento del webhook), **When** se procesa,
   **Then** el agente responde **una sola vez** (idempotencia).

---

### User Story 3 - El agente envía la mejor ficha de propiedad (Priority: P2)

Como cliente, quiero recibir por WhatsApp la ficha de la propiedad que mejor encaja con lo que busco;
como asesor, quiero que el agente lo haga solo cuando ya calificó al cliente, de modo que el cliente
reciba algo útil sin que yo intervenga.

**Why this priority**: Convierte la calificación + matching en una acción de valor para el cliente.
Depende de US1 (ranking) y US2 (agente).

**Independent Test**: Tras calificar a un cliente con el agente, verificar que el agente envía por
WhatsApp la ficha (nombre, operación, zona, precio, specs) de la propiedad con mayor afinidad, y que
esa ficha queda registrada como mensaje saliente en el hilo.

**Acceptance Scenarios**:

1. **Given** un cliente calificado con al menos un match relevante, **When** el agente decide
   ofrecerle una propiedad, **Then** envía por WhatsApp la ficha de la de mayor afinidad (nombre,
   operación, zona, precio, specs) y la registra en el hilo.
2. **Given** que no hay ninguna propiedad con afinidad suficiente, **When** el agente evalúa enviar,
   **Then** **no** envía una ficha irrelevante; lo comunica o pide más datos.
3. **Given** una ficha enviada, **When** se mira el hilo, **Then** aparece como el último mensaje de la
   conversación (consistente con el panel de matching de 003).

---

### User Story 4 - El agente propone y agenda una visita (Priority: P2)

Como cliente interesado, quiero poder acordar una visita por WhatsApp; como asesor, quiero que el
agente proponga horarios y registre la visita, de modo que la cita quede en la agenda sin trabajo
manual.

**Why this priority**: Cierra el ciclo de atención (de interés → visita). Depende de US2/US3.

**Independent Test**: Conversar como cliente pidiendo ver una propiedad y verificar que el agente
propone agendar, y que al acordar, se registra una visita (cliente, propiedad, fecha/hora, asesor) y
aparece en Visitas.

**Acceptance Scenarios**:

1. **Given** un cliente que expresa interés en ver una propiedad, **When** el agente responde, **Then**
   propone agendar una visita y pide/confirma fecha y hora.
2. **Given** que el cliente acepta una fecha/hora, **When** el agente lo procesa, **Then** registra una
   visita (cliente, propiedad, fecha/hora, asesor asignado) visible en la vista de Visitas (003).
3. **Given** una visita agendada, **When** corresponde, **Then** queda disponible el recordatorio
   automático por WhatsApp (plantilla aprobada) definido en features previas (DV-2).

---

### User Story 5 - Handoff a un humano (Priority: P2)

Como asesor, quiero que el agente me pase la conversación cuando el cliente quiere cerrar, toca un
tema sensible o pide hablar con una persona, de modo que yo tome el control en el momento clave.

**Why this priority**: Es la garantía del modo híbrido: la IA atiende, el humano cierra. Reduce el
riesgo de que la IA maneje sola un momento delicado.

**Independent Test**: Conversar como cliente y pedir "quiero hablar con un asesor" o señales de cierre,
y verificar que el agente deja de responder solo, marca la conversación para atención humana y avisa al
asesor.

**Acceptance Scenarios**:

1. **Given** una conversación con el agente activo, **When** el cliente pide hablar con una persona, o
   expresa intención de cierre/negociación, o toca un tema sensible, **Then** el agente hace **handoff**:
   deja de responder automáticamente y marca la conversación para atención humana.
2. **Given** un handoff, **When** el asesor mira la bandeja, **Then** la conversación se distingue como
   "requiere atención humana" (señal visible) y el agente queda en pausa hasta que el asesor decida.
3. **Given** una conversación en handoff, **When** el asesor responde a mano, **Then** sus mensajes
   salen como del asesor (no del agente) y el agente no interfiere.

---

### Edge Cases

- **Fuera de la ventana de 24 h**: el cliente escribió hace más de 24 h. El agente no puede mandar texto
  libre; debe usar una plantilla aprobada o avisar al asesor en lugar de fallar en silencio.
- **El agente no entiende / pregunta ambigua**: pide aclaración con amabilidad; no inventa.
- **Inventario vacío o sin coincidencias**: lo comunica con claridad; no ofrece propiedades inexistentes.
- **Mensaje no textual** (audio, imagen, ubicación): el agente reconoce que no es texto y responde
  apropiadamente o hace handoff (alcance de v1: solo texto se procesa por IA).
- **El cliente cambia de requisitos a media conversación**: el agente actualiza los requisitos y el
  matching refleja el cambio.
- **Coste / fallo del proveedor de IA**: si el modelo no responde, el sistema degrada con gracia (no
  rompe la bandeja; el asesor puede atender a mano) y el fallo no se reporta como respuesta enviada.
- **Doble disparo por reintento de webhook**: una sola respuesta del agente por mensaje entrante.
- **Tema sensible/legal o fuera de dominio inmobiliario**: handoff, no respuesta autónoma.

## Requirements *(mandatory)*

### Functional Requirements

**Requisitos del cliente y matching (US1)**

- **FR-001**: El sistema MUST poder almacenar los **requisitos** de un cliente: operación (venta/renta),
  presupuesto (rango), zona, tipo de propiedad, recámaras y baños, asociados al cliente/conversación del
  tenant. Los requisitos MUST ser editables por el asesor y rellenables por el agente de IA.
- **FR-002**: El sistema MUST calcular, a partir de los requisitos del cliente y el inventario del
  tenant, un **ranking de propiedades por afinidad** con: un porcentaje de match, razones discretas
  (cada criterio cumple/no cumple) y una explicación breve en lenguaje natural.
- **FR-003**: El cálculo del matching MUST considerar **solo** propiedades del tenant de la conversación
  (aislamiento) y MUST reflejar cambios de requisitos en el ranking.
- **FR-004**: El panel "Matching en vivo" (feature 003) MUST mostrar el ranking **real** (reemplazando
  los datos de muestra) y MUST comunicar con claridad el caso de "sin requisitos" y el de "sin
  coincidencias".

**Agente conversacional (US2)**

- **FR-005**: El agente de IA MUST poder activarse/desactivarse **por conversación** (opt-in). Cuando
  está desactivado, MUST no responder automáticamente.
- **FR-006**: Con el agente activo y dentro de la ventana de 24 h, ante un mensaje **de texto** entrante
  el sistema MUST generar y enviar una respuesta en español (MX), amable y pertinente al contexto de la
  conversación y al inventario real.
- **FR-007**: El agente MUST **calificar** al cliente: extraer de la conversación sus requisitos
  (FR-001) y guardarlos/actualizarlos, de modo que alimenten el matching (FR-002).
- **FR-008**: El agente MUST **no inventar** propiedades, precios ni datos: solo puede afirmar lo que
  existe en el inventario del tenant; ante falta de datos, pide aclaración.
- **FR-009**: El procesamiento de mensajes entrantes por el agente MUST ser **idempotente**: un mismo
  mensaje (mismo identificador) no genera dos respuestas.
- **FR-010**: La UI MUST distinguir los mensajes enviados por el **agente** de los enviados por un
  humano.

**Acciones del agente (US3, US4)**

- **FR-011**: El agente MUST poder **enviar la ficha** (nombre, operación, zona, precio, specs) de la
  propiedad con mayor afinidad cuando el cliente está calificado y existe un match relevante; si no hay
  match suficiente, MUST no enviar una ficha irrelevante.
- **FR-012**: El agente MUST poder **proponer y agendar una visita**: al acordar fecha/hora con el
  cliente, registra una visita (cliente, propiedad, fecha/hora, asesor) visible en la vista de Visitas.

**Handoff y modo híbrido (US5)**

- **FR-013**: El agente MUST hacer **handoff** a atención humana cuando el cliente pide hablar con una
  persona, expresa intención de cierre/negociación, o toca un tema sensible/fuera de dominio; tras el
  handoff MUST dejar de responder automáticamente hasta que el asesor decida.
- **FR-014**: La bandeja MUST señalar visiblemente las conversaciones que **requieren atención humana**
  (handoff).

**Transversales (seguridad, plataforma, dominio)**

- **FR-015**: El agente MUST respetar la **ventana de 24 h**: dentro responde con texto libre; fuera usa
  una plantilla aprobada o avisa al asesor (no envía texto libre fuera de ventana).
- **FR-016**: El agente MUST **no generar ni firmar contratos** ni hacer promesas vinculantes; el foco es
  inmobiliario (informar, calificar, matchear, agendar) — constitución Principio VIII.
- **FR-017**: El sistema MUST mantener el **aislamiento multi-tenant** en todo el flujo del agente
  (datos, inventario, requisitos, visitas solo del tenant de la conversación).
- **FR-018**: Las credenciales del proveedor de IA MUST gestionarse como secreto de plataforma (no
  expuestas al cliente ni a logs) — constitución Principio I.
- **FR-019**: Si el proveedor de IA falla o no responde, el sistema MUST degradar con gracia (la bandeja
  sigue usable, el asesor atiende a mano) y **no** marcar como enviada una respuesta que no salió.
- **FR-020**: Todo el texto del agente MUST estar en español (México), con tono amable, profesional y
  efectivo.

### Key Entities *(include if feature involves data)*

- **Requisitos del cliente** *(nuevo)*: criterios de búsqueda de un cliente — operación, presupuesto
  (rango), zona, tipo, recámaras, baños, notas; origen (extraído por IA / capturado por asesor); fecha
  de actualización. Asociado a un cliente/conversación del tenant. Alimenta el matching.
- **Match (calculado)**: propiedad + porcentaje de afinidad + razones (cumple/no cumple por criterio) +
  explicación. Resultado del cruce requisitos↔inventario; contenido del panel "Matching en vivo".
- **Estado del agente por conversación** *(nuevo)*: si el agente está activo (opt-in) y si la
  conversación está en handoff (requiere atención humana).
- **Mensaje** *(existente, extendido)*: además de dirección/estado, distingue el **autor** (agente vs
  humano) y puede ser una ficha de propiedad.
- **Visita (muestra)** *(existente)*: cliente, propiedad, fecha/hora, asesor, estado — la puede crear el
  agente (US4).
- **Propiedad / inventario** *(existente)*: fuente de verdad del matching y de las fichas; el agente solo
  usa propiedades reales del tenant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una conversación de prueba donde el cliente describe lo que busca, el agente propone la
  propiedad que **mejor empata** (la de mayor afinidad real según sus requisitos) en al menos el **90%**
  de los casos de prueba definidos.
- **SC-002**: El agente **califica correctamente** al cliente: tras una conversación de prueba, los
  requisitos capturados (operación, presupuesto, zona, tipo, recámaras) coinciden con lo que el cliente
  dijo en al menos el **90%** de los campos aplicables.
- **SC-003**: Las respuestas del agente son **amables y efectivas**: en una evaluación de las
  conversaciones de prueba, el 100% están en español MX, sin inventar propiedades/precios, y resuelven o
  avanzan la conversación (sin respuestas vacías o fuera de tema).
- **SC-004**: El agente **nunca ofrece** una propiedad inexistente o un precio inventado en las
  conversaciones de prueba (0 alucinaciones de inventario).
- **SC-005**: Un mensaje entrante repetido (reintento) produce **exactamente una** respuesta del agente
  (0 respuestas duplicadas).
- **SC-006**: El handoff ocurre cuando debe: en los casos de prueba de cierre/"quiero un asesor"/tema
  sensible, el agente cede a humano el **100%** de las veces y deja de auto-responder.
- **SC-007**: Con el agente desactivado, **0** respuestas automáticas se envían.
- **SC-008**: La verificación automática (typecheck + lint + build) pasa en verde y la verificación de
  comportamiento (auto-test conversando como cliente con el número de prueba) corrobora SC-001…SC-006.

## Assumptions

- **Modelos de IA (decisión del dueño)**: el cerebro conversacional del agente es
  `deepseek/deepseek-v4-flash` y el ranking de matching usa `deepseek/deepseek-v4-pro`, ambos vía
  OpenRouter con una clave **de plataforma** (variable de entorno) en el MVP; per-tenant más adelante.
- **Enfoque del matching**: combinación de filtro por criterios duros + valoración con IA para rankear y
  explicar; el detalle técnico se define en el plan. El inventario de un agencia chica es de decenas a
  bajos cientos de propiedades.
- **Datos de prueba**: se usan **propiedades de muestra/fixtures** (las introducidas en 003) como
  inventario para validar el comportamiento; el matching real opera sobre el inventario del tenant cuando
  exista persistencia.
- **Presupuesto del cliente**: se interpreta como objetivo con tolerancia razonable (no un corte
  estrictamente binario), salvo que el cliente indique un máximo duro.
- **Alcance de canal**: en v1 el agente procesa **mensajes de texto**; audio/imagen/ubicación se reconocen
  pero no se interpretan por IA (handoff o respuesta genérica).
- **Transparencia**: el agente atiende a nombre de la agencia; el asesor siempre ve qué mensajes envió el
  agente y puede tomar el control.
- **Constitución**: se mantienen modo claro, español MX, foco inmobiliario, aislamiento de tenant,
  idempotencia de webhooks y prohibición de generar contratos.
- **Sprint cerrado** cuando el auto-test (conversación como cliente vía número personal ↔ número de
  prueba) corrobora matching efectivo, calificación correcta, ficha correcta y respuestas amables y
  efectivas.

## Dependencies

- Feature 003 (sistema de diseño): panel "Matching en vivo", ficha de propiedad, vista de Visitas y la
  bandeja rediseñada que esta feature vuelve "reales".
- Bandeja y WhatsApp Cloud API (features 001): envío de texto/plantilla, ventana de 24 h, webhooks
  idempotentes; envío saliente ya corregido (normalización MX).
- Proveedor de IA (OpenRouter) y los modelos DeepSeek indicados.
- Inventario de propiedades, clientes, conversaciones y visitas (modelo de dominio existente) + el nuevo
  modelo de **requisitos del cliente** y el **estado del agente por conversación**.
