# Feature Specification: Administración de propiedades (inventario CRUD real)

**Feature Branch**: `007-property-management`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "El usuario puede a través de la sección de propiedades agregar nuevas propiedades, quitarlas, marcarlas según su estatus, desplegar cada tarjeta para consultar la información completa de cada una y ver a qué clientes hacen match."

## Resumen

Hoy la sección de propiedades (`/properties`) muestra **datos de muestra** y el botón "Nueva
propiedad" es **cosmético** (no guarda nada). Esta feature convierte esa pantalla en el inventario
**real** del tenant: el asesor crea, edita, marca estatus, archiva, abre el detalle completo con
todas sus fotos, gestiona esas fotos (subir/reordenar/eliminar) y ve **qué clientes encajan** con
cada propiedad. Todo queda con alcance estricto por organización (multi-tenant).

Dos decisiones de alcance acordadas con el dueño:
- **Quitar = archivar** (soft-delete reversible), nunca borrado duro, para conservar el historial
  ligado (conversaciones, visitas, candidaturas, fichas ya enviadas).
- El **match es bidireccional**: además del actual cliente→propiedades, se añade
  propiedad→**clientes**, y una mini-edición **manual** de los requisitos del cliente para que ese
  match tenga con qué comparar aunque la IA no haya extraído nada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear y editar propiedades reales (Priority: P1)

El asesor abre `/properties`, pulsa "Nueva propiedad", llena un formulario con los datos del
inmueble (operación, tipo, título, precio y moneda, ubicación, recámaras, baños, superficies,
estacionamientos, descripción, estatus) y la guarda. La propiedad aparece de inmediato en el
inventario del tenant. Puede volver a abrirla y editar cualquier campo.

**Why this priority**: Sin crear/editar propiedades reales, todo lo demás (fotos, fichas de
WhatsApp, matching) opera sobre datos ficticios. Es el cimiento del inventario y reemplaza los
`SAMPLE_PROPERTIES` por datos persistidos.

**Independent Test**: Crear una propiedad, recargar la página y verla listada con sus datos;
editar su precio y confirmar que el cambio persiste tras recargar. Otro tenant no la ve.

**Acceptance Scenarios**:

1. **Given** un asesor autenticado en su organización, **When** crea una propiedad con datos
   válidos, **Then** se guarda con `organization_id` de su tenant y aparece en el inventario.
2. **Given** una propiedad existente del tenant, **When** el asesor edita uno o varios campos,
   **Then** solo esos campos se actualizan y el resto se conserva.
3. **Given** un formulario con datos inválidos (p. ej. precio negativo o tipo no permitido),
   **When** intenta guardar, **Then** el sistema rechaza con un mensaje claro y no persiste nada.
4. **Given** una propiedad de **otra** organización, **When** un asesor intenta verla o editarla,
   **Then** el sistema responde "no encontrada" (sin filtrar datos cruzados entre tenants).

---

### User Story 2 - Marcar estatus y archivar (Priority: P1)

Desde la tarjeta o el detalle, el asesor cambia rápidamente el estatus de una propiedad entre
**disponible / apartada / cerrada** sin entrar al formulario completo. Cuando una propiedad ya no
debe figurar en el inventario activo, la **archiva**; deja de aparecer en la lista por defecto pero
su historial se conserva y puede **desarchivarla** después.

**Why this priority**: El estatus y el archivado son la operación diaria del inventario; "quitar"
sin perder trazabilidad es un requisito explícito del dueño.

**Independent Test**: Cambiar el estatus de una propiedad y verlo reflejado tras recargar;
archivar una propiedad y confirmar que desaparece del inventario activo pero su conversación/visita
asociada sigue existiendo; desarchivarla y verla volver.

**Acceptance Scenarios**:

1. **Given** una propiedad disponible, **When** el asesor la marca "apartada", **Then** el estatus
   cambia y se refleja en tarjeta, detalle y filtros.
2. **Given** una propiedad con conversaciones, visitas o candidaturas ligadas, **When** el asesor
   la archiva, **Then** se oculta del inventario activo pero **no** se borra ni se rompe el
   historial relacionado.
3. **Given** una propiedad archivada, **When** el asesor la desarchiva, **Then** vuelve al
   inventario activo con su estatus previo.
4. **Given** el inventario activo, **When** el asesor aplica el filtro "archivadas", **Then** ve
   solo las archivadas (las activas quedan ocultas).

---

### User Story 3 - Ver el detalle completo con galería de fotos (Priority: P2)

El asesor "despliega" una tarjeta para abrir el detalle de la propiedad: ve **todos** los campos y
una **galería con todas sus fotos** (no solo la principal). Desde ahí gestiona las fotos: sube
nuevas, reordena para definir cuál es la **principal**, y elimina las que no quiere.

**Why this priority**: El dueño pidió explícitamente "desplegar cada tarjeta para consultar la
información completa". La gestión de fotos da, por fin, **fotos reales** a la ficha de WhatsApp de
la feature 006 (hoy las pone un seed de desarrollo).

**Independent Test**: Abrir el detalle de una propiedad, subir 2 fotos, marcar una como principal,
eliminar una, y confirmar que la galería refleja el orden y que la foto principal es la que usaría
la ficha de WhatsApp.

**Acceptance Scenarios**:

1. **Given** una propiedad del tenant, **When** el asesor abre su detalle, **Then** ve todos sus
   campos y la galería completa de fotos en orden.
2. **Given** el detalle abierto, **When** el asesor sube una foto válida (imagen dentro del límite
   de tamaño), **Then** la foto queda asociada a la propiedad y visible en la galería.
3. **Given** varias fotos, **When** el asesor reordena o marca una como principal, **Then** ese
   orden persiste y la principal es la primera de la galería.
4. **Given** una foto existente, **When** el asesor la elimina, **Then** desaparece de la galería y
   del almacenamiento, sin afectar las demás fotos.
5. **Given** una propiedad sin fotos, **When** se intenta usarla como ficha de WhatsApp, **Then**
   el comportamiento degrada según la feature 006 (sin foto → texto), sin error.

---

### User Story 4 - Ver clientes que hacen match con una propiedad (Priority: P2)

Desde el detalle de una propiedad, el asesor ve la lista de **clientes del tenant cuyos requisitos
encajan** con esa propiedad, ordenados por porcentaje de coincidencia, con las razones (presupuesto,
zona, tipo, recámaras, baños). Es la dirección **inversa** del matching actual (que va de un cliente
a sus propiedades candidatas).

**Why this priority**: Es una petición explícita ("ver a qué clientes hacen match") y el
diferenciador del producto. Reutiliza el scoring determinista existente invirtiendo la entrada.

**Independent Test**: Con al menos un cliente cuyos requisitos coincidan, abrir el detalle de una
propiedad y ver a ese cliente listado con su porcentaje y razones; cambiar la propiedad fuera de
rango (p. ej. precio) y ver que el match baja o desaparece.

**Acceptance Scenarios**:

1. **Given** una propiedad y clientes con requisitos en el tenant, **When** el asesor abre el match
   inverso, **Then** ve los clientes que encajan ordenados por porcentaje, con sus razones.
2. **Given** ningún cliente con requisitos compatibles, **When** abre el match inverso, **Then** ve
   un estado vacío claro (no un error).
3. **Given** clientes de otra organización, **When** se calcula el match, **Then** nunca aparecen
   (alcance por tenant).

---

### User Story 5 - Editar requisitos del cliente manualmente (Priority: P3)

El asesor abre un cliente y crea o edita sus **requisitos de búsqueda** (operación, presupuesto
min/máx, zona, tipo, recámaras, baños, notas) a mano. Estos requisitos quedan marcados como de
origen **manual** y alimentan tanto el match inverso (US4) como el matching existente.

**Why this priority**: Habilitador de US4: sin requisitos, el match inverso sale vacío. Hoy los
requisitos solo los llena la IA; esto da al asesor control directo. Es P3 porque US4 ya entrega
valor con los requisitos que la IA haya extraído.

**Independent Test**: Crear requisitos manuales para un cliente sin requisitos previos, luego abrir
una propiedad compatible y ver a ese cliente aparecer en el match inverso.

**Acceptance Scenarios**:

1. **Given** un cliente sin requisitos, **When** el asesor los crea manualmente con datos válidos,
   **Then** se guardan con origen "manual" y quedan disponibles para el matching.
2. **Given** un cliente con requisitos de origen IA, **When** el asesor los edita manualmente,
   **Then** se actualizan los campos provistos y el matching se recalcula con los nuevos valores.
3. **Given** requisitos inválidos (p. ej. presupuesto mínimo mayor al máximo), **When** intenta
   guardar, **Then** el sistema rechaza con un mensaje claro y no persiste.

---

### Edge Cases

- **Propiedad sin foto**: la ficha de WhatsApp degrada a texto (feature 006); el detalle muestra un
  placeholder, no un error.
- **Archivar y volver a usar**: una propiedad archivada no debe aparecer en el inventario activo ni
  ofrecerse para enviar fichas nuevas, pero las conversaciones/fichas históricas que la referencian
  siguen siendo válidas.
- **Foto demasiado grande o tipo no permitido**: el sistema rechaza la subida con mensaje claro;
  no deja archivos huérfanos en el almacenamiento.
- **Subida interrumpida**: si la foto se sube al almacenamiento pero no se confirma su registro (o
  viceversa), el sistema no debe mostrar fotos rotas ni dejar basura no referenciada.
- **Cambio de foto principal**: siempre debe existir a lo más una principal; si se elimina la
  principal, la siguiente en orden pasa a ser principal automáticamente.
- **Match inverso con muchos clientes**: la lista se limita y ordena por porcentaje; clientes con 0%
  no se listan.
- **Eliminar la última foto** de una propiedad la deja válida (sin fotos), no en estado inconsistente.
- **Edición concurrente**: dos asesores del mismo tenant editando la misma propiedad — el último
  guardado gana por campo; no se corrompe el registro.

## Requirements *(mandatory)*

### Functional Requirements

**Inventario / CRUD**

- **FR-001**: El sistema MUST permitir crear una propiedad con los campos del dominio (operación
  renta/venta; tipo casa/departamento/local/terreno; título; precio y moneda; dirección, colonia,
  ciudad; recámaras; baños; superficie construida; superficie de lote; estacionamientos;
  descripción; estatus), validando todo input externo y rechazando datos inválidos.
- **FR-002**: El sistema MUST asignar a cada propiedad creada el `organization_id` del asesor y
  registrar quién la creó.
- **FR-003**: El sistema MUST permitir editar una propiedad existente del tenant de forma parcial
  (solo los campos enviados se modifican).
- **FR-004**: El sistema MUST listar en `/properties` únicamente las propiedades del tenant del
  asesor, con datos **reales** (sin `SAMPLE_PROPERTIES`), conservando los filtros por operación y
  estatus ya existentes.
- **FR-005**: El sistema MUST impedir el acceso (ver/editar/archivar) a propiedades de otra
  organización, respondiendo como "no encontrada".

**Estatus / archivado**

- **FR-006**: El sistema MUST permitir cambiar el estatus de una propiedad entre disponible,
  apartada y cerrada desde una acción rápida (sin abrir el formulario completo).
- **FR-007**: El sistema MUST permitir **archivar** una propiedad (soft-delete): se oculta del
  inventario activo pero se conserva el registro y todo su historial relacionado (conversaciones,
  visitas, candidaturas, mensajes/fichas que la referencian).
- **FR-008**: El sistema MUST permitir **desarchivar** una propiedad para devolverla al inventario
  activo.
- **FR-009**: El sistema MUST excluir por defecto las propiedades archivadas del inventario activo,
  del envío de nuevas fichas y de los cálculos de matching, y MUST ofrecer una vista/filtro para
  consultarlas.
- **FR-010**: El sistema MUST NOT ofrecer borrado duro de propiedades en esta feature.

**Detalle y fotos**

- **FR-011**: El sistema MUST mostrar un detalle de la propiedad con **todos** sus campos y una
  **galería de todas** sus fotos en orden.
- **FR-012**: El sistema MUST permitir subir fotos a una propiedad mediante carga directa al
  almacenamiento de objetos (S3-compatible) usando credenciales/URL temporales, validando tipo y
  tamaño del archivo.
- **FR-013**: El sistema MUST permitir reordenar las fotos y designar cuál es la **principal**, y
  MUST garantizar que exista a lo más una principal por propiedad.
- **FR-014**: El sistema MUST permitir eliminar una foto, borrándola tanto del almacenamiento como
  de su registro, sin afectar las demás; al eliminar la principal, la siguiente en orden pasa a ser
  principal.
- **FR-015**: La foto principal MUST ser la que consume la ficha de WhatsApp (feature 006); sin
  fotos, el envío degrada a texto sin error.

**Matching inverso y requisitos**

- **FR-016**: El sistema MUST listar, para una propiedad dada, los clientes del tenant cuyos
  requisitos encajan, ordenados por porcentaje de coincidencia y con las razones del match,
  reutilizando el scoring determinista existente con la entrada invertida.
- **FR-017**: El sistema MUST excluir del match inverso a clientes sin requisitos compatibles
  (0%) y MUST mostrar un estado vacío claro cuando no haya coincidencias.
- **FR-018**: El sistema MUST permitir crear y editar manualmente los requisitos de un cliente
  (operación, presupuesto min/máx, zona, tipo, recámaras, baños, notas), marcándolos de origen
  **manual**, validando el input y recalculando el matching afectado.
- **FR-019**: Toda consulta y mutación (propiedades, fotos, requisitos, match) MUST estar acotada
  al `organization_id` del asesor; ninguna operación cruza tenants.

**Migración / datos**

- **FR-020**: El cambio de esquema para soportar el archivado MUST ser **aditivo** (no destructivo)
  y aplicarse en el flujo de despliegue existente.

### Key Entities *(include if feature involves data)*

- **Propiedad**: el inmueble del inventario. Atributos de dominio (operación, tipo, precio,
  ubicación, características) + estatus (disponible/apartada/cerrada) + marca de **archivado**.
  Pertenece a una organización; la crea un usuario. Se relaciona con conversaciones, visitas,
  candidaturas y mensajes (que esta feature debe preservar al archivar).
- **Foto de propiedad**: imagen almacenada en el almacenamiento de objetos, con orden y marca de
  principal. Pertenece a una propiedad y a la organización; se borra en cascada si la propiedad
  desaparece (no aplica aquí porque sólo se archiva).
- **Requisitos del cliente**: criterios de búsqueda del cliente (operación, presupuesto, zona,
  tipo, recámaras, baños, notas) con un **origen** (IA o manual). Insumo del matching en ambas
  direcciones.
- **Match (resultado)**: para una propiedad y un cliente, un porcentaje de coincidencia y las
  razones (presupuesto, zona, tipo, recámaras, baños). No necesariamente persistido; se calcula
  bajo demanda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un asesor puede crear una propiedad completa y verla listada en su inventario en
  menos de 2 minutos, sin ayuda técnica.
- **SC-002**: El inventario en `/properties` muestra exclusivamente datos reales del tenant; cero
  registros de muestra aparecen para una organización con datos propios.
- **SC-003**: Archivar una propiedad la retira del inventario activo en el mismo flujo, y el 100% de
  su historial relacionado (conversaciones, visitas, candidaturas, fichas) sigue accesible.
- **SC-004**: El asesor puede subir, reordenar y eliminar fotos, y la foto marcada como principal es
  la que aparece en la ficha de WhatsApp enviada para esa propiedad.
- **SC-005**: Para una propiedad con clientes compatibles, el match inverso muestra al menos esos
  clientes con su porcentaje y razones; para una propiedad sin compatibles, muestra un estado vacío
  (nunca un error).
- **SC-006**: Tras crear requisitos manuales para un cliente compatible, ese cliente aparece en el
  match inverso de la propiedad correspondiente.
- **SC-007**: Ninguna operación de esta feature expone o modifica datos de otra organización
  (verificado con dos tenants distintos).
- **SC-008**: "Hecho" se cumple sólo cuando typecheck + lint + build pasan **y** un self-test de
  comportamiento E2E recorre crear→foto→estatus→archivar y el match inverso, incluido el camino
  infeliz (input inválido, propiedad sin foto, cero matches).

## Assumptions

- Se reutiliza el esquema actual de `property` y `property_photo`; el archivado se añade de forma
  aditiva (campo/marca nueva), sin migración destructiva.
- El scoring de matching reutiliza la lógica determinista existente (feature 004) invirtiendo la
  entrada; el rerank por IA es opcional y degrada al determinista si falla.
- La subida de fotos usa el almacenamiento S3-compatible ya configurado (R2 en MVP) vía
  carga directa con credenciales temporales; el límite de tamaño/tipo sigue las prácticas ya usadas
  por el seed de fotos.
- La autenticación, el control de tenant (Better Auth + organización) y los helpers de
  almacenamiento ya existen y se reutilizan.
- El detalle de la propiedad puede presentarse como panel/hoja dentro de `/properties` o como ruta
  propia; la decisión visual concreta se resuelve en el plan, no afecta el alcance.
- La gestión de requisitos manuales reutiliza el servicio de upsert de requisitos existente
  (feature 004), sólo cambiando el origen a "manual".
- Esta feature **no** genera contratos ni documentos (fuera de alcance por constitución); sólo
  administra el inventario y sus relaciones.
