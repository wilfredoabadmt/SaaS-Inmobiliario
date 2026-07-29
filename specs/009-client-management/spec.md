# Feature Specification: Gestión de contactos vinculada a la bandeja

**Feature Branch**: `009-client-management`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "Manejar a los clientes: hoy solo se listan; quiero que también se puedan
agregar y modificar, y sobre todo que tengan vínculo con la bandeja de chat. Si llega un nuevo chat al
número, que el contacto se agregue automáticamente a la base de contactos obteniendo la mayor info
posible desde la fuente. Hoy solo WhatsApp; a futuro Messenger e Instagram. Cada contacto debe mostrar,
en una esquina de su avatar, el ícono del canal por el que llegó. Desde la página de contactos, un botón
'Enviar mensaje' que redirige a la bandeja, donde se siguen las reglas del canal (p. ej. ventana 24h de
WhatsApp cerrada → iniciar con plantilla)."

## Aclaración de vocabulario

El dueño habla de **"contactos"**; el dominio existente del producto modela esa misma realidad como la
entidad **`client`** (cliente). En esta spec **"contacto" = "cliente"**: la página de "Contactos" es la
sección de clientes hecha real. No se introduce una entidad nueva paralela; se enriquece la existente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gestionar contactos reales (P1)

Hoy la página de contactos solo muestra datos de muestra (no consulta la base de datos) y no permite
crear ni editar. El asesor o el dueño necesita una libreta de contactos real: ver la lista verdadera de
su organización, **agregar** un contacto a mano, **editar** sus datos y **ver su detalle**.

**Why this priority**: Es la base del módulo. Sin una lista real y CRUD, ninguna de las demás piezas
(auto-alta, badge, atajo a la bandeja) tiene dónde mostrarse ni operarse. Entrega valor por sí sola:
una agenda de contactos funcional con aislamiento por organización.

**Independent Test**: Iniciar sesión, ir a Contactos, crear un contacto nuevo (nombre + teléfono),
verlo aparecer en la lista, abrir su detalle, editar su nombre/notas y confirmar que el cambio persiste
tras recargar — todo dentro de la organización del usuario y sin ver contactos de otra organización.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado (owner o agent) con contactos en su organización, **When** abre la
   página de Contactos, **Then** ve la lista real de contactos de SU organización (no datos de muestra) y
   ninguno de otra organización.
2. **Given** la página de Contactos, **When** crea un contacto con nombre y teléfono válidos, **Then** el
   contacto queda guardado y aparece en la lista inmediatamente.
3. **Given** un contacto existente, **When** edita su nombre, email o notas y guarda, **Then** los cambios
   persisten y se reflejan en la lista y el detalle.
4. **Given** un contacto existente, **When** edita su teléfono a uno ya usado por OTRO contacto de la
   misma organización, **Then** el sistema rechaza el cambio con un mensaje claro de duplicado.
5. **Given** un intento de crear un contacto con un teléfono ya existente en la organización, **When**
   guarda, **Then** el sistema lo impide e indica que ese contacto ya existe.

---

### User Story 2 - Auto-alta y enriquecimiento desde la bandeja (P1)

Cuando llega un mensaje entrante de un remitente que aún no es contacto, el sistema debe darlo de alta
automáticamente en la base de contactos, capturando **la mayor información posible disponible en la
fuente** (canal) y registrando **el canal por el que llegó**. Así el dueño nunca pierde un prospecto: que
alguien le escriba ya lo convierte en contacto.

**Why this priority**: Es el corazón del "vínculo con la bandeja" que pidió el dueño. Convierte cada
conversación entrante en un contacto trazable y es lo que diferencia esta agenda de una libreta manual.

**Independent Test**: Desde el número de prueba, enviar un mensaje al número de la plataforma con un
remitente que NO existe como contacto; verificar que aparece un contacto nuevo en la lista con el nombre
de perfil (si la fuente lo expone), el teléfono y el **canal de origen = WhatsApp**, y que su conversación
queda enlazada en la bandeja.

**Acceptance Scenarios**:

1. **Given** un remitente cuyo teléfono no existe como contacto, **When** envía su primer mensaje entrante,
   **Then** se crea un contacto con su teléfono, su nombre de perfil (si la fuente lo provee) y canal de
   origen = WhatsApp, y queda enlazado a su conversación.
2. **Given** un contacto creado a mano con un teléfono, **When** ese mismo teléfono envía después un
   mensaje entrante, **Then** NO se duplica el contacto: se enriquece el existente (se completa lo que esté
   vacío y se fija/registra su canal de origen real) sin sobrescribir datos editados por el usuario.
3. **Given** un remitente sin nombre de perfil expuesto por la fuente, **When** se da de alta, **Then** el
   contacto se crea igual usando el teléfono como identidad y no falla por la falta de nombre.
4. **Given** un mismo evento entrante entregado más de una vez por el proveedor, **When** se procesa,
   **Then** no se crean contactos ni conversaciones duplicados (idempotencia).

---

### User Story 3 - Badge de canal sobre el avatar (P2)

Cada contacto en la lista debe mostrar, en una esquina del círculo de su avatar, el ícono del canal por el
que llegó: hoy el logo de WhatsApp; preparado para Instagram y Messenger a futuro. Un contacto creado a
mano (que aún no llegó por ningún canal) muestra un indicador neutro de "manual".

**Why this priority**: Da legibilidad visual inmediata sobre el origen de cada contacto y prepara el
producto multicanal. Es valioso pero secundario al CRUD y a la auto-alta.

**Independent Test**: Ver la lista de contactos y confirmar que cada contacto llegado por WhatsApp muestra
el logo de WhatsApp superpuesto en su avatar, y que un contacto creado a mano muestra el indicador neutro.

**Acceptance Scenarios**:

1. **Given** un contacto con canal de origen WhatsApp, **When** se ve en la lista, **Then** su avatar
   muestra el logo de WhatsApp en una esquina.
2. **Given** un contacto creado manualmente que nunca se ha comunicado por un canal, **When** se ve en la
   lista, **Then** su avatar muestra un indicador neutro de origen manual (sin logo de canal).
3. **Given** el modelo de canales, **When** en el futuro se agregue Instagram o Messenger, **Then** el
   badge puede representar esos canales sin rediseñar el modelo (extensibilidad).

---

### User Story 4 - "Enviar mensaje" como atajo a la bandeja (P2)

Desde la página de contactos, un botón **"Enviar mensaje"** lleva al usuario a la bandeja de chat enfocada
en la conversación de ese contacto. **La bandeja es la única responsable de aplicar las reglas del canal**:
si detecta que la ventana de servicio de 24h de WhatsApp está cerrada, no permite texto libre y obliga a
iniciar con una plantilla aprobada; si está abierta, permite texto normal. El módulo de contactos no
duplica esa lógica: solo redirige.

**Why this priority**: Conecta la agenda con la operación diaria (responder/escribir) sin reinventar las
reglas de mensajería, que ya viven en la bandeja. Útil pero depende de que la bandeja ya gobierne esas
reglas.

**Independent Test**: Desde el detalle o la fila de un contacto, pulsar "Enviar mensaje" y verificar que
la app navega a la bandeja con la conversación de ese contacto enfocada/abierta; con la ventana 24h cerrada,
comprobar que la bandeja exige plantilla (no deja texto libre).

**Acceptance Scenarios**:

1. **Given** un contacto con una conversación existente, **When** el usuario pulsa "Enviar mensaje",
   **Then** la app abre la bandeja con esa conversación enfocada.
2. **Given** que la conversación enfocada tiene la ventana de 24h CERRADA, **When** el usuario intenta
   escribir, **Then** la bandeja le impide el texto libre y le exige seleccionar una plantilla aprobada.
3. **Given** que la ventana de 24h está ABIERTA, **When** el usuario escribe, **Then** la bandeja permite
   enviar texto libre con normalidad.
4. **Given** un contacto sin conversación previa, **When** el usuario pulsa "Enviar mensaje", **Then** la
   app lo lleva a la bandeja para ese contacto y es la bandeja quien decide cómo iniciar según las reglas
   del canal (no el módulo de contactos).

---

### Edge Cases

- **Teléfono duplicado al crear/editar manualmente**: el sistema bloquea con mensaje claro; nunca crea un
  segundo contacto con el mismo teléfono dentro de la organización.
- **Inbound de un teléfono que ya es contacto manual**: se fusiona/enriquece el existente por la llave
  (organización, teléfono); no se duplica.
- **Enriquecimiento limitado por la fuente**: WhatsApp solo expone nombre de perfil y teléfono en el
  entrante; no provee email ni foto. Esos campos quedan vacíos hasta que se ingresen a mano. El alta NO
  falla por datos faltantes.
- **Contacto sin nombre**: se muestra el teléfono como identidad y las iniciales/avatar se derivan de él.
- **Enriquecimiento vs. edición manual**: el enriquecimiento automático completa campos vacíos pero NO
  sobrescribe valores que el usuario editó a mano.
- **Reintentos de webhook**: la auto-alta es idempotente; eventos repetidos no duplican contacto ni
  conversación.
- **Aislamiento entre organizaciones**: ningún listado, búsqueda, edición o auto-alta puede leer o tocar
  contactos de otra organización.
- **"Enviar mensaje" fuera de la ventana 24h**: lo resuelve la bandeja (plantilla obligatoria), no este
  módulo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST listar los contactos reales de la organización del usuario (sustituyendo los
  datos de muestra actuales), ordenados de forma útil (p. ej. actividad/creación más reciente) y con
  búsqueda por nombre/teléfono.
- **FR-002**: Los usuarios MUST poder crear un contacto manualmente con, al menos, nombre y teléfono; email
  y notas opcionales.
- **FR-003**: Los usuarios MUST poder editar los datos de un contacto (nombre, email, notas) y guardar los
  cambios de forma persistente.
- **FR-004**: El sistema MUST permitir editar el teléfono de un contacto, validando unicidad por
  organización; si el nuevo teléfono ya pertenece a otro contacto de la organización, MUST rechazar el
  cambio con un error claro.
- **FR-005**: Los usuarios MUST poder ver el detalle de un contacto (sus datos y el acceso a su
  conversación en la bandeja).
- **FR-006**: El sistema MUST dar de alta automáticamente un contacto cuando llega un mensaje entrante de
  un remitente que aún no existe como contacto en la organización.
- **FR-007**: En el alta automática, el sistema MUST capturar la mayor información disponible en la fuente
  (para WhatsApp: nombre de perfil y teléfono) sin fallar si algún dato no está presente.
- **FR-008**: El sistema MUST registrar el **canal de origen** de cada contacto mediante un conjunto de
  valores **extensible** (hoy: WhatsApp; preparado para Instagram y Messenger; "manual" para los creados a
  mano).
- **FR-009**: El sistema MUST garantizar unicidad de contacto por (organización, teléfono): un entrante de
  un teléfono ya existente enriquece el contacto existente en lugar de duplicarlo.
- **FR-010**: El enriquecimiento automático MUST completar únicamente campos vacíos y NO sobrescribir
  valores que el usuario haya editado manualmente.
- **FR-011**: La auto-alta MUST ser idempotente respecto a los reintentos de eventos del proveedor (no
  duplica contactos ni conversaciones).
- **FR-012**: Cada contacto en la lista MUST mostrar un badge del canal de origen superpuesto en su avatar
  (logo de WhatsApp hoy; indicador neutro para "manual"; representable para IG/Messenger a futuro).
- **FR-013**: La página de contactos MUST ofrecer una acción "Enviar mensaje" que navega a la bandeja
  enfocada en la conversación del contacto.
- **FR-014**: La aplicación de las reglas del canal (p. ej. ventana 24h de WhatsApp cerrada → exigir
  plantilla aprobada; abierta → texto libre) MUST recaer en la bandeja, NO en el módulo de contactos; este
  módulo solo redirige.
- **FR-015**: Todas las operaciones sobre contactos MUST estar restringidas por organización y disponibles
  para los roles owner y agent (reusando el control de acceso existente del proyecto).
- **FR-016**: El sistema MUST mantener el vínculo bidireccional contacto ↔ conversación: desde un contacto
  se llega a su conversación en la bandeja, y desde una conversación se identifica a su contacto.
- **FR-017**: Los secretos/credenciales del canal NUNCA se exponen al cliente ni a logs como parte de estas
  operaciones (se reusa el manejo cifrado existente).

### Key Entities *(include if feature involves data)*

- **Contacto (cliente)**: persona con la que la organización se comunica. Atributos: nombre (opcional),
  teléfono (identidad de mensajería, único por organización), email (opcional), notas (opcional), **canal
  de origen**, marcas de tiempo. Pertenece a una organización. Tiene una o más conversaciones.
- **Canal de origen**: valor enumerado y **extensible** que indica por dónde llegó/se originó el contacto
  (whatsapp | instagram | messenger | manual). Hoy solo whatsapp está operativo; el resto es preparación
  del modelo.
- **Conversación**: hilo de mensajería que enlaza un contacto con un canal. Ya existe en el producto; esta
  feature la usa como destino del atajo "Enviar mensaje" y como disparador de la auto-alta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los remitentes entrantes nuevos quedan registrados como contacto, con su canal de
  origen correcto, y son visibles en la lista en cuestión de segundos tras su primer mensaje.
- **SC-002**: Un usuario puede crear un contacto nuevo en menos de 30 segundos y verlo en la lista de
  inmediato.
- **SC-003**: Desde un contacto, el usuario llega a su conversación correcta en la bandeja con una sola
  acción ("Enviar mensaje").
- **SC-004**: Cero contactos duplicados para un mismo teléfono dentro de una organización, incluso ante
  reintentos de webhook o mezcla de alta manual + entrante.
- **SC-005**: El 100% de los contactos muestran un badge de origen (logo de canal para los llegados por un
  canal; indicador neutro para los manuales).
- **SC-006**: Con la ventana de 24h cerrada, el inicio de conversación desde la bandeja exige plantilla el
  100% de las veces (regla aplicada por la bandeja, verificable desde ella).
- **SC-007**: Ningún usuario puede ver, editar o crear contactos fuera de su organización (0 fugas entre
  tenants).

## Assumptions

- El módulo de "Contactos" opera sobre la entidad de dominio existente `client`; no se crea una entidad
  nueva paralela.
- WhatsApp es el único canal operativo hoy; el modelo se deja **preparado** para Instagram y Messenger,
  pero esta feature NO los opera (sin recibir ni enviar por esos canales).
- El enriquecimiento desde WhatsApp se limita a lo que el entrante de la fuente provee (nombre de perfil +
  teléfono); no hay email ni foto disponibles desde WhatsApp, así que esos campos quedan vacíos salvo
  captura manual.
- El **canal de origen** se interpreta como el primer canal real por el que el contacto se comunicó; los
  contactos creados a mano se marcan como "manual" hasta que (si ocurre) se comuniquen por un canal.
- El teléfono es editable y su unicidad se valida por organización.
- La bandeja ya gobierna la ventana de 24h y el envío de plantillas aprobadas (heredado de features
  previas); esta feature **reutiliza** esa lógica y no la reimplementa.
- "Enviar mensaje" es un atajo de navegación a la bandeja; la decisión de texto libre vs. plantilla la toma
  la bandeja.
- La auto-alta de contacto/conversación ante un entrante ya existe parcialmente en el producto; esta
  feature la completa registrando el canal de origen y haciéndola visible en una lista real.
- Tanto owner como agent pueden gestionar contactos.

## Out of Scope

- Operar Instagram o Messenger (recibir/enviar): solo se prepara el modelo de canal.
- Importación masiva de contactos (CSV) o sincronización con agendas externas.
- Interfaz de fusión manual de contactos duplicados (la deduplicación es automática por teléfono).
- Borrado duro de contactos (descartado: arrastra en cascada conversación/mensajes/candidaturas/contratos).
  **Nota (adición post-spec, pedido del dueño)**: SÍ se añadió **archivar** un contacto = soft-delete
  reversible (oculta de la lista, conserva todo, se restaura; un inbound nuevo lo reactiva), espejando el
  patrón "archivar" de propiedades (007). Ver `data-model.md` (`client.archived_at`) y tasks T022–T026.
- Operación de contactos por el agente IA (la gestión es manual; el agente sigue su flujo existente).
