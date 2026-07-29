# Feature Specification: CRM Inmobiliario con WhatsApp

**Feature Branch**: `001-realestate-whatsapp-crm`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "CRM para agencias inmobiliarias cuyo canal principal de comunicación es WhatsApp. Sirve a agencias que manejan tanto RENTA como VENTA de propiedades. Usuarios: dueño de la agencia (admin) y agente colaborador. Historias por prioridad: P1 núcleo de comunicación, P2 dominio inmobiliario core, P3 operación comercial, P4 documentos y contratos (MVP simplificado, sin generación de contratos)."

## Clarifications

### Session 2026-06-07

- Q: ¿Qué campos exactos describen una propiedad? → A: Conjunto estándar — tipo de
  operación (renta/venta), tipo de inmueble (casa/departamento/local/terreno),
  precio y moneda, ubicación (dirección/colonia/ciudad), recámaras, baños,
  superficie (m²), estacionamientos, estado (disponible/apartada/cerrada) y
  descripción libre.
- Q: ¿Qué estados puede tener un candidato en su seguimiento? → A: Pipeline de 8
  estados — Nuevo → Contactado → Calificado → Visita agendada → Documentación → En
  negociación → Ganado → Perdido.
- Q: ¿Una conversación se asocia a una o varias propiedades? → A: A varias
  (relación muchos-a-muchos); una puede marcarse opcionalmente como "principal" para
  mostrarse en la bandeja.
- Q: ¿Cuántas fotos por propiedad y límite de tamaño? → A: Hasta 20 fotos por
  propiedad, máximo 10 MB por archivo, en formatos JPG/PNG/WebP.
- Q: ¿Un candidato se vincula a una o varias propiedades? → A: Cada candidatura es un
  par (cliente, propiedad); un mismo cliente puede ser candidato de varias
  propiedades, cada candidatura con su propio estado de pipeline.

## User Scenarios & Testing *(mandatory)*

Las historias están ordenadas por prioridad de entrega (P1 → P4). Cada una es un
incremento entregable e independientemente verificable. **Regla de recorte de
alcance**: si hay que recortar durante la implementación, se completan P1, P2 y P3
antes de comenzar P4.

### User Story 1 - Centralizar la comunicación de WhatsApp en una bandeja única (Priority: P1)

El dueño conecta el WhatsApp de la agencia sin escribir código y, a partir de ese
momento, todo el equipo atiende a los clientes desde una sola bandeja compartida,
con apoyo de plantillas de mensaje aprobadas.

**Why this priority**: Sin el canal de comunicación centralizado no existe
producto: es la razón por la que una agencia adopta la herramienta. Entrega valor
por sí sola incluso sin el resto del dominio inmobiliario.

**Independent Test**: Conectar un número de WhatsApp de prueba, enviar un mensaje
entrante desde un teléfono externo, verlo aparecer en la bandeja, responder desde
la bandeja y enviar una plantilla aprobada — todo sin abrir la app de WhatsApp.

**Acceptance Scenarios**:

1. **Given** un dueño con su número de WhatsApp de agencia, **When** completa el
   flujo guiado de conexión, **Then** la agencia queda conectada sin que el dueño
   haya escrito código ni configurado nada técnico manualmente.
2. **Given** una agencia conectada, **When** un cliente externo envía un mensaje al
   número de la agencia, **Then** la conversación aparece en la bandeja única del
   equipo.
3. **Given** una conversación en la bandeja, **When** un agente escribe y envía una
   respuesta, **Then** el cliente la recibe por WhatsApp sin que el agente use otra
   aplicación.
4. **Given** una conversación abierta, **When** un agente elige una plantilla
   aprobada (p. ej. confirmación de cita o ficha de propiedad), **Then** el mensaje
   se envía con el formato de la plantilla.
5. **Given** que el proveedor reenvía el mismo evento entrante dos veces, **When**
   el sistema lo recibe, **Then** la conversación/bandeja muestra el mensaje una
   sola vez (sin duplicados).

---

### User Story 2 - Gestionar el catálogo de propiedades y vincular conversaciones (Priority: P2)

La agencia administra su inventario de propiedades (en renta o en venta), vincula
cada conversación a la propiedad de la que se está hablando y registra a los
clientes interesados como candidatos para darles seguimiento estructurado.

**Why this priority**: Convierte la bandeja genérica en un CRM inmobiliario real:
sin catálogo ni vínculo conversación↔propiedad, la herramienta sería solo
mensajería. Depende de P1 (bandeja) para vincular conversaciones.

**Independent Test**: Crear una propiedad en el catálogo, abrir una conversación,
asociarla a esa propiedad y registrar al cliente como candidato de esa propiedad;
verificar que la asociación y el candidato quedan visibles para el equipo.

**Acceptance Scenarios**:

1. **Given** un usuario con permiso, **When** registra una propiedad indicando si es
   en renta o en venta, **Then** la propiedad aparece en el catálogo de la agencia.
2. **Given** una propiedad existente, **When** el usuario la edita o la lista,
   **Then** ve los cambios reflejados y la propiedad aparece en el listado del
   catálogo.
3. **Given** una conversación entrante y una propiedad del catálogo, **When** el
   agente asocia la conversación a la propiedad, **Then** la conversación queda
   etiquetada con esa propiedad y el equipo puede ver de qué inmueble se trata.
4. **Given** una conversación asociada a una propiedad, **When** el agente registra
   al cliente como candidato de esa propiedad, **Then** el candidato queda creado y
   disponible para seguimiento.

---

### User Story 3 - Operar muestras y equipo (Priority: P3)

El agente agenda visitas (muestras) de propiedades con recordatorio para no perder
citas, y el dueño incorpora a su equipo de agentes con roles para que todos
trabajen sobre la misma bandeja y catálogo.

**Why this priority**: Habilita la operación comercial diaria (visitas) y el trabajo
en equipo. Aporta valor sobre P1+P2 pero no es indispensable para demostrar el
núcleo del CRM.

**Independent Test**: Invitar a un agente con rol, iniciar sesión como ese agente,
agendar una muestra de una propiedad y comprobar que se recibe el recordatorio
antes de la cita.

**Acceptance Scenarios**:

1. **Given** un dueño, **When** invita a un agente y le asigna un rol, **Then** el
   agente puede acceder y trabajar sobre la bandeja y el catálogo de esa agencia.
2. **Given** un agente y una propiedad, **When** agenda una muestra con fecha y
   hora, **Then** la muestra queda registrada y asociada a la propiedad.
3. **Given** una muestra agendada, **When** se acerca la fecha/hora de la cita,
   **Then** el agente responsable recibe un recordatorio antes de la cita.
4. **Given** roles diferenciados, **When** un agente intenta una acción reservada al
   dueño (p. ej. gestionar el equipo), **Then** el sistema se lo impide.

---

### User Story 4 - Expediente de candidatos y seguimiento de contratos (Priority: P4)

El agente arma el expediente documental de un candidato y rastrea el avance de un
contrato (de renta o de venta) generado por fuera del sistema, sin que el sistema
genere ningún documento legal.

**Why this priority**: Completa el ciclo comercial pero es la parte más acotada del
MVP y la primera candidata a recortarse. **El sistema NO genera contratos**: solo
almacena los que el agente sube y rastrea su estado.

**Independent Test**: Subir documentos de un candidato (p. ej. identificación y
comprobante de ingresos), subir un contrato externo, cambiar su estado a lo largo
del flujo y verificar que el estado refleja el último valor establecido.

**Acceptance Scenarios**:

1. **Given** un candidato, **When** el agente sube documentos (identificación,
   comprobante de ingresos), **Then** los documentos quedan almacenados en el
   expediente del candidato.
2. **Given** una operación, **When** el agente sube un contrato generado por fuera,
   **Then** el contrato queda almacenado y asociado a la operación/candidato.
3. **Given** un contrato almacenado, **When** el agente cambia su estado entre
   *borrador*, *enviado*, *en negociación* y *firmado*, **Then** el sistema
   registra y muestra el estado actual.
4. **Given** cualquier momento del flujo, **When** un usuario busca generar un
   contrato dentro del sistema, **Then** la función no existe (fuera de alcance v1):
   el sistema solo permite subir y rastrear.

---

### Edge Cases

- ¿Qué ocurre cuando llega un mensaje entrante de un número que no corresponde a
  ninguna conversación previa? (debe crear una conversación nueva en la bandeja).
- ¿Qué ocurre si la conexión de WhatsApp se cae o expira? (el sistema debe señalar
  el estado de la conexión y no perder mensajes silenciosamente).
- ¿Qué pasa si dos agentes responden la misma conversación casi al mismo tiempo?
- ¿Qué pasa al intentar eliminar una propiedad que tiene conversaciones, candidatos
  o muestras asociadas?
- ¿Qué pasa con una muestra cuya fecha ya pasó sin marcarse como realizada?
- ¿Qué ocurre si se sube un archivo de tipo no soportado o que excede el límite?
- ¿Qué ocurre cuando un agente invitado es removido del equipo mientras tiene
  conversaciones o candidatos asignados?

## Requirements *(mandatory)*

### Functional Requirements

**Comunicación (P1)**

- **FR-001**: El sistema MUST permitir al dueño conectar el número de WhatsApp de la
  agencia mediante un flujo guiado, sin que el dueño escriba código.
- **FR-002**: El sistema MUST mostrar todas las conversaciones entrantes de WhatsApp
  de la agencia en una bandeja única compartida por el equipo.
- **FR-003**: El sistema MUST permitir a un agente leer y responder los mensajes de
  una conversación desde la bandeja, sin usar otra aplicación.
- **FR-004**: El sistema MUST permitir enviar plantillas de mensaje aprobadas (p.
  ej. confirmación de cita, ficha de propiedad).
- **FR-005**: El sistema MUST procesar los eventos entrantes de WhatsApp de forma
  idempotente: recibir el mismo evento más de una vez NO crea mensajes ni
  conversaciones duplicadas.
- **FR-006**: El sistema MUST resguardar las credenciales y tokens de la conexión de
  WhatsApp de modo que nunca se muestren a ningún usuario ni aparezcan en registros.

**Multi-tenant y roles**

- **FR-007**: El sistema MUST aislar los datos de cada agencia; ningún usuario puede
  ver ni modificar conversaciones, propiedades, candidatos, muestras o documentos de
  otra agencia.
- **FR-008**: El sistema MUST soportar al menos dos roles —Dueño (admin) y Agente—
  con permisos diferenciados (la gestión de cuenta y equipo es exclusiva del Dueño).
- **FR-009**: El dueño MUST poder invitar agentes a su agencia y asignarles un rol.

**Dominio inmobiliario (P2)**

- **FR-010**: El sistema MUST permitir registrar, editar y listar propiedades en un
  catálogo por agencia.
- **FR-011**: Cada propiedad MUST indicar su tipo de operación: renta o venta.
- **FR-012**: El sistema MUST permitir describir cada propiedad con los siguientes
  campos: tipo de operación (renta/venta), tipo de inmueble (casa/departamento/
  local/terreno), precio y moneda, ubicación (dirección/colonia/ciudad), recámaras,
  baños, superficie (m²), estacionamientos, estado (disponible/apartada/cerrada) y
  descripción libre.
- **FR-013**: El sistema MUST permitir adjuntar hasta 20 fotos por propiedad, con un
  máximo de 10 MB por archivo, en formatos de imagen comunes (JPG/PNG/WebP).
- **FR-014**: Un agente MUST poder asociar una conversación de WhatsApp a una o
  varias propiedades del catálogo (relación muchos-a-muchos); puede marcar
  opcionalmente una de ellas como propiedad "principal" de la conversación, que se
  muestra en la bandeja.
- **FR-015**: Un agente MUST poder registrar a un cliente como candidato de una
  propiedad. Cada candidatura es un par (cliente, propiedad) con su propio estado de
  seguimiento; un mismo cliente PUEDE ser candidato de varias propiedades a la vez,
  cada una con estado independiente. Estados: Nuevo → Contactado → Calificado →
  Visita agendada → Documentación → En negociación → Ganado → Perdido.

**Operación comercial (P3)**

- **FR-016**: Un agente MUST poder agendar una muestra (visita) de una propiedad con
  fecha y hora, asociada a la propiedad correspondiente.
- **FR-017**: El sistema MUST notificar al agente responsable un recordatorio de la
  muestra antes de la cita.
- **FR-018**: El sistema MUST permitir que varios agentes de la misma agencia
  trabajen sobre la misma bandeja y el mismo catálogo.

**Documentos y contratos (P4)**

- **FR-019**: Un agente MUST poder subir y almacenar documentos de un candidato (p.
  ej. identificación, comprobante de ingresos) dentro de su expediente.
- **FR-020**: Un agente MUST poder subir un contrato (de renta o de venta) generado
  por fuera del sistema y asociarlo a la operación/candidato/propiedad.
- **FR-021**: El sistema MUST permitir rastrear el estado de un contrato entre, al
  menos: *borrador*, *enviado*, *en negociación* y *firmado*.
- **FR-022**: El sistema MUST NOT generar contratos ni ningún documento legal; su
  función se limita a almacenar los documentos subidos y rastrear su estado.
- **FR-023**: Los documentos y contratos almacenados MUST estar protegidos y
  aislados por agencia, conforme a FR-007.

### Key Entities *(include if feature involves data)*

- **Agencia (Tenant)**: organización inmobiliaria; unidad de aislamiento de todos
  los datos. Tiene usuarios, una conexión de WhatsApp, un catálogo y candidatos.
- **Usuario**: persona que accede al sistema; pertenece a una agencia; tiene rol
  (Dueño o Agente).
- **Conexión de WhatsApp**: vínculo del número de la agencia con el canal; mantiene
  credenciales resguardadas y un estado (conectado/caído).
- **Conversación**: hilo de mensajes con un cliente vía WhatsApp; puede vincularse a
  varias propiedades (muchos-a-muchos), con una opcional marcada como "principal".
- **Mensaje**: unidad entrante o saliente dentro de una conversación.
- **Plantilla de mensaje**: contenido aprobado y reutilizable para envío rápido.
- **Propiedad**: inmueble del catálogo. Campos: tipo de operación (renta/venta),
  tipo de inmueble, precio y moneda, ubicación, recámaras, baños, superficie (m²),
  estacionamientos, estado y descripción libre; admite hasta 20 fotos (máx. 10 MB
  cada una).
- **Candidato (candidatura)**: par (cliente, propiedad) en seguimiento; un mismo
  cliente puede tener varias candidaturas (una por propiedad), cada una con su estado
  independiente: Nuevo, Contactado, Calificado, Visita agendada, Documentación, En
  negociación, Ganado y Perdido.
- **Muestra (Visita)**: cita para mostrar una propiedad; tiene fecha/hora, agente
  responsable y recordatorio.
- **Documento**: archivo del expediente de un candidato (p. ej. identificación,
  comprobante de ingresos).
- **Contrato**: documento generado externamente, asociado a una operación; tiene un
  estado (borrador/enviado/en negociación/firmado).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un dueño conecta el WhatsApp de su agencia y recibe el primer mensaje
  entrante en la bandeja en menos de 15 minutos, sin asistencia técnica.
- **SC-002**: Un agente puede ver y responder cualquier conversación entrante desde
  una sola bandeja, sin abrir la aplicación de WhatsApp por separado.
- **SC-003**: El 100% de los mensajes entrantes aparece una sola vez en la bandeja,
  incluso cuando el proveedor reenvía el mismo evento.
- **SC-004**: Ningún usuario puede acceder a datos de una agencia distinta a la suya
  (0 cruces de datos entre tenants en pruebas de aislamiento).
- **SC-005**: Un agente asocia una conversación a una propiedad y registra un
  candidato en menos de 1 minuto.
- **SC-006**: El 100% de las muestras agendadas generan un recordatorio que el
  agente responsable recibe antes de la cita.
- **SC-007**: Un agente sube el expediente de un candidato y registra/actualiza el
  estado de un contrato; el estado mostrado siempre coincide con el último valor
  establecido.
- **SC-008**: Las credenciales de WhatsApp no son visibles para ningún usuario ni
  aparecen en registros (verificable por inspección de interfaz y de registros).

## Assumptions

- En v1, cada agencia opera **un (1) número** de WhatsApp (el usuario se refiere a
  "el WhatsApp de mi agencia" en singular).
- La bandeja es **compartida por todo el equipo** de la agencia (la historia P3
  indica que el equipo trabaja sobre la misma bandeja).
- Las plantillas de mensaje están **previamente aprobadas** antes de poder enviarse
  (práctica estándar del canal WhatsApp).
- El **momento del recordatorio** de la muestra usará un valor por defecto razonable
  (p. ej. 24 h y 1 h antes), ajustable; no es una de las preguntas abiertas críticas.
- Los **clientes finales** (destinatarios de WhatsApp) NO son usuarios del sistema y
  no inician sesión.
- El **idioma** de la interfaz es español (mercado objetivo inmobiliario hispano).
- El sistema es **multi-tenant** y **self-hosted** conforme a la constitución del
  proyecto (Principios II y III).

## Out of Scope (v1)

- **Generación** automática de contratos o de cualquier documento legal (el sistema
  solo almacena y rastrea estado — FR-022).
- Firma electrónica de contratos.
- Cobros, pagos o facturación dentro del sistema.
- Portales públicos de listados o sitios web de propiedades para el cliente final.
- Soporte de más de un número de WhatsApp por agencia.
- Cualquier funcionalidad que no sirva a una agencia inmobiliaria gestionando
  propiedades y clientes (constitución, Principio VIII).
