# Feature Specification: Pipeline de ventas real

**Feature Branch**: `010-sales-pipeline`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: pipeline de ventas real que reemplaza el Kanban cosmético de `/pipeline` (hoy con fixtures `SAMPLE_LEADS`). Vuelve operativo el embudo conectándolo a la entidad real de negociación (cliente + propiedad + etapa + agente, con aislamiento por organización), con cuatro mejoras pedidas por el dueño: (1) etapas del embudo configurables desde la misma vista; (2) mover tarjetas arrastrándolas (clic-y-arrastrar) además de los botones; (3) abrir una tarjeta para ver el detalle del cliente, su conversación y la propiedad relacionada; (4) asignación real de agentes (hoy son valores de prueba).

## User Scenarios & Testing *(mandatory)*

Actores:
- **Agente** (miembro con rol *agent*): opera el día a día — ve el tablero, mueve tarjetas, abre el detalle, asigna/reasigna.
- **Dueño** (miembro con rol *owner*): todo lo del agente **más** configurar las etapas del embudo de su agencia.

Contexto: cada tarjeta es un **trato** (un cliente negociando una propiedad). El tablero muestra solo los tratos de la organización activa.

### User Story 1 - Tablero real con datos de candidaturas y mover entre etapas (Priority: P1)

Como agente, abro `/pipeline` y veo el embudo con **mis tratos reales** (no datos de muestra): cada columna es una etapa y cada tarjeta un trato de mi agencia, con el cliente, la propiedad (o "sin propiedad"), la operación (renta/venta) y el agente asignado. Puedo mover un trato a otra etapa y el cambio **persiste** (sigue ahí al recargar y lo ve el resto del equipo).

**Why this priority**: Es el cimiento. Sin datos reales y persistencia, ninguna de las mejoras (configurar, arrastrar, abrir, asignar) tiene sobre qué operar. Entrega valor por sí sola: convierte una pantalla decorativa en un tablero de trabajo real.

**Independent Test**: Con al menos un trato real en la organización, cargar `/pipeline`, ver la tarjeta en su columna de etapa, moverla a otra etapa (con los botones existentes), recargar la página y confirmar que quedó en la nueva etapa; iniciar sesión como otro miembro de la misma agencia y verla en la misma posición.

**Acceptance Scenarios**:

1. **Given** mi agencia tiene tratos en distintas etapas, **When** abro `/pipeline`, **Then** veo cada trato como una tarjeta en la columna de su etapa actual, con cliente, propiedad (o "sin propiedad"), operación y agente.
2. **Given** un trato en "Contactado", **When** lo muevo a "Calificado", **Then** el conteo de cada columna se actualiza y, al recargar, el trato permanece en "Calificado".
3. **Given** un cliente sin propiedad aún asociada, **When** existe como trato en una etapa temprana, **Then** la tarjeta se muestra con la marca "sin propiedad" en lugar de fallar u ocultarse.
4. **Given** que pertenezco a la agencia A, **When** cargo el tablero, **Then** no veo ningún trato de la agencia B (aislamiento de tenant).
5. **Given** un trato cuyo cliente o propiedad fue archivado, **When** cargo el tablero, **Then** el trato se omite (no contamina el embudo con registros archivados).
6. **Given** un contacto nuevo escribe por primera vez (inbound), **When** el sistema lo da de alta, **Then** aparece automáticamente como una tarjeta en la **etapa inicial** ("Nuevo"), sin propiedad, sin tener que crearla a mano.

---

### User Story 2 - Configurar las etapas del embudo por agencia (Priority: P2)

Como dueño, desde la misma vista del pipeline entro a un modo "Configurar etapas" y **personalizo el embudo de mi agencia**: renombrar, agregar, eliminar y reordenar etapas intermedias. Los cambios se reflejan en el tablero para todo el equipo. Las etapas ancla **Ganado**, **Perdido** y **Visita agendada** siempre existen y no se pueden eliminar (el dashboard de cierres y la automatización de visitas dependen de ellas).

**Why this priority**: Es la mejora más pedida: que el embudo sea "el de su agencia" y no uno impuesto. Alto valor de adopción. Va después del P1 porque configurar etapas requiere que el tablero ya opere sobre etapas reales.

**Independent Test**: Como dueño, renombrar una etapa intermedia y reordenarla; confirmar que el tablero (propio y de otro miembro) muestra el nuevo nombre y orden; intentar eliminar "Ganado" y ver que se impide; iniciar sesión como agente y confirmar que no puede entrar al modo de configuración.

**Acceptance Scenarios**:

1. **Given** soy dueño, **When** abro "Configurar etapas", **Then** veo la lista ordenada de etapas de mi agencia, con las ancla (Ganado/Perdido/Visita agendada) marcadas como no eliminables.
2. **Given** estoy configurando, **When** renombro "Calificado" a "Precalificado" y guardo, **Then** el tablero muestra "Precalificado" en esa columna sin perder los tratos que tenía.
3. **Given** estoy configurando, **When** reordeno una etapa intermedia, **Then** el orden de columnas del tablero cambia para todo el equipo.
4. **Given** estoy configurando, **When** agrego una etapa nueva, **Then** aparece como columna vacía en el tablero en la posición elegida.
5. **Given** intento eliminar una etapa ancla, **When** confirmo, **Then** la acción se rechaza con un mensaje claro de que es un estado fijo.
6. **Given** soy agente (no dueño), **When** intento abrir "Configurar etapas", **Then** la opción no está disponible / se rechaza.
7. **Given** una agencia que nunca configuró su embudo, **When** un miembro abre el pipeline por primera vez, **Then** ve un embudo por defecto sembrado (Nuevo, Contactado, Calificado, Visita agendada, Documentación, En negociación, Ganado, Perdido) idéntico al actual.

---

### User Story 3 - Arrastrar tarjetas entre etapas (drag-and-drop) (Priority: P2)

Como agente, muevo un trato a otra etapa **arrastrándolo con el mouse** (clic-y-arrastrar) y soltándolo en la columna destino, que es más cómodo que los botones. Los botones de avanzar/retroceder etapa se conservan como alternativa accesible. El tablero se desplaza horizontalmente y cada columna verticalmente de forma cómoda con el mouse.

**Why this priority**: Es la fricción más mencionada del tablero actual (solo se mueve con botones, y el scroll es incómodo). Mejora directa de productividad diaria. Depende del P1 (mover ya persiste) — el drag-and-drop es otra forma de disparar el mismo cambio.

**Independent Test**: Arrastrar una tarjeta de una columna a otra, soltarla, y confirmar que persiste (igual que con botones); soltar fuera de cualquier columna válida y confirmar que no cambia nada; con muchas tarjetas, comprobar que la columna hace scroll vertical y el tablero scroll horizontal con el mouse.

**Acceptance Scenarios**:

1. **Given** un trato en "Nuevo", **When** lo arrastro y lo suelto sobre "Contactado", **Then** la tarjeta queda en "Contactado" y el cambio persiste al recargar.
2. **Given** estoy arrastrando una tarjeta, **When** la suelto fuera de cualquier columna válida, **Then** vuelve a su columna original y no se registra ningún cambio.
3. **Given** una columna con más tarjetas de las que caben, **When** uso la rueda del mouse sobre ella, **Then** la columna hace scroll vertical cómodo; y el tablero permite scroll horizontal para ver todas las etapas.
4. **Given** un usuario que prefiere no arrastrar, **When** usa los botones de etapa anterior/siguiente, **Then** siguen funcionando como antes.

---

### User Story 4 - Abrir una tarjeta y ver el detalle (Priority: P3)

Como agente, hago clic en una tarjeta (sin arrastrar) y se abre un **panel de detalle** con la información del cliente (nombre, teléfono, badge del canal de origen), sus requisitos de búsqueda, la **propiedad relacionada** del trato, y un resumen de los últimos mensajes de su conversación. Desde el panel puedo ir a la conversación en la bandeja ("Abrir en bandeja") y a la ficha de la propiedad.

**Why this priority**: Hoy las tarjetas no se pueden abrir; el dueño quiere "ver al cliente y su conversación" sin salir del flujo del pipeline. Es alto valor pero apoyado en datos que ya existen (cliente, requisitos, conversación, propiedad), por eso va tras las mejoras de manipulación del tablero.

**Independent Test**: Hacer clic en una tarjeta, ver el panel con datos reales del cliente, sus requisitos, la propiedad y un resumen de mensajes; pulsar "Abrir en bandeja" y confirmar que lleva a la conversación correcta; cerrar el panel y volver al tablero sin perder estado.

**Acceptance Scenarios**:

1. **Given** una tarjeta de un trato, **When** hago clic en ella (sin arrastrar), **Then** se abre un panel lateral con nombre, teléfono y badge de canal del cliente.
2. **Given** el panel abierto, **When** el cliente tiene requisitos de búsqueda y/o una propiedad relacionada, **Then** el panel los muestra; si falta alguno, muestra un estado vacío claro en vez de fallar.
3. **Given** el panel abierto, **When** pulso "Abrir en bandeja", **Then** navego a la conversación de ese cliente en la bandeja (la bandeja decide las reglas de canal y la ventana de 24 h; el pipeline no las reimplementa).
4. **Given** el panel abierto, **When** el trato tiene una propiedad, **Then** un enlace me lleva a la ficha de esa propiedad.
5. **Given** una tarjeta cuyo cliente no tiene conversación todavía, **When** abro el panel, **Then** "Abrir en bandeja" se desactiva o resuelve la conversación, sin error.

---

### User Story 5 - Asignación real de agente (Priority: P3)

Como miembro de la agencia, asigno o reasigno un trato a un **agente real** de mi organización (dueño o agente) desde la tarjeta o el panel de detalle. La tarjeta muestra el agente asignado (avatar/inicial) o "Sin asignar". Solo se puede asignar a miembros de la organización.

**Why this priority**: Cierra el bucle operativo (quién atiende cada trato) y reemplaza las asignaciones de prueba por reales. Depende de tener tratos reales (P1) y se beneficia del panel de detalle (P3).

**Independent Test**: Asignar un trato a un agente real y confirmar que la tarjeta muestra a ese agente y persiste; reasignar a otro; intentar asignar a alguien que no es miembro de la organización y confirmar que se rechaza; dejar/poner "Sin asignar".

**Acceptance Scenarios**:

1. **Given** un trato "Sin asignar", **When** lo asigno a un agente de mi organización, **Then** la tarjeta muestra a ese agente y el cambio persiste.
2. **Given** un trato asignado, **When** lo reasigno a otro miembro, **Then** la tarjeta refleja el nuevo agente.
3. **Given** intento asignar a un usuario que no pertenece a mi organización, **When** confirmo, **Then** la acción se rechaza.
4. **Given** un trato asignado, **When** lo dejo "Sin asignar", **Then** la tarjeta muestra el estado sin asignar.

---

### Edge Cases

- **Mover a etapa inexistente o no permitida** (p. ej. una etapa que otro miembro acaba de eliminar): el sistema rechaza el movimiento y refresca el tablero al estado real.
- **Arrastrar sin soltar en columna válida**: la tarjeta regresa a su columna original; ningún cambio se persiste.
- **Aislamiento de tenant**: ningún miembro puede ver, mover, abrir ni reasignar tratos de otra organización; los intentos por identificador directo fallan como "no encontrado".
- **Reasignar a no-miembro**: se rechaza explícitamente.
- **Eliminar una etapa que tiene tarjetas**: la configuración no puede dejar tratos "huérfanos"; el sistema exige reubicar esas tarjetas (mover a otra etapa) antes de eliminar, o lo impide con un mensaje claro.
- **Eliminar/renombrar una etapa ancla**: renombrar una ancla puede permitirse (cambia la etiqueta visible) pero eliminarla nunca; el sistema lo impide.
- **Avance vs retroceso de automatizaciones**: agendar una visita a un trato que ya está en "Documentación"/"En negociación" **no lo retrocede** a "Visita agendada" (regla de avance, FR-029/FR-030); solo avanza tratos que estaban antes de esa ancla. El usuario sí puede retroceder a mano.
- **Inbound repetido**: varios mensajes inbound del mismo contacto **no** crean varias tarjetas; el auto-alta del trato es idempotente (a lo sumo un trato sin-propiedad por cliente).
- **Concurrencia**: si dos miembros mueven la misma tarjeta casi a la vez, gana el último cambio y ambos tableros convergen al recargar/refrescar; no se corrompe el estado ni se duplica el trato.
- **Cliente o propiedad archivados** (features 007/009): sus tratos se omiten del tablero; reactivar el cliente los vuelve a mostrar.
- **Trato sin propiedad**: la tarjeta y el panel funcionan mostrando "sin propiedad"; las acciones dependientes de propiedad (enlace a ficha) se desactivan.
- **Pipeline vacío**: una agencia sin tratos ve las columnas (según su configuración) vacías con un estado claro, no una pantalla rota.

## Requirements *(mandatory)*

### Functional Requirements

**Tablero y datos reales (US1)**

- **FR-001**: El sistema MUST mostrar en `/pipeline` los tratos reales de la organización activa, agrupados por etapa, en lugar de datos de muestra.
- **FR-002**: Cada tarjeta MUST mostrar el cliente, la propiedad relacionada (o "sin propiedad"), la operación (renta/venta) y el agente asignado (o "Sin asignar").
- **FR-003**: El sistema MUST permitir mover un trato de una etapa a otra y persistir el cambio, visible para todos los miembros de la organización.
- **FR-004**: El sistema MUST aislar los tratos por organización: ningún miembro puede ver ni modificar tratos de otra organización.
- **FR-005**: El sistema MUST omitir del tablero los tratos cuyo cliente o propiedad esté archivado (features 007/009).
- **FR-006**: El sistema MUST crear automáticamente un trato en la **etapa inicial** (la de menor orden, normalmente "Nuevo") cuando entra el **primer mensaje inbound** de un contacto (extiende el auto-alta de contacto de 009), de modo que **todo contacto entrante aparezca en el pipeline**. El trato nace **sin propiedad** (la propiedad se concreta después). Idempotente: a lo sumo un trato sin-propiedad por cliente.
- **FR-006b**: Los usuarios MUST poder además agregar un trato a mano desde el pipeline para un cliente existente, con propiedad opcional (alta manual, complementaria al auto-alta por inbound).

**Etapas configurables (US2)**

- **FR-007**: El sistema MUST mantener, por organización, un conjunto ordenado de etapas del embudo, editable de forma independiente entre organizaciones.
- **FR-008**: El sistema MUST sembrar un embudo por defecto para cada organización con las etapas actuales (Nuevo, Contactado, Calificado, Visita agendada, Documentación, En negociación, Ganado, Perdido), de modo que el comportamiento visible no cambie hasta que el dueño personalice.
- **FR-009**: El dueño (owner) MUST poder renombrar, agregar, eliminar y reordenar etapas **intermedias** desde la propia vista del pipeline.
- **FR-010**: El sistema MUST tratar **Ganado**, **Perdido** y **Visita agendada** como etapas ancla que siempre existen y no se pueden eliminar; renombrar su etiqueta visible MAY permitirse, pero su rol (cierre ganado / cierre perdido / destino de la automatización de visitas) se conserva.
- **FR-011**: El sistema MUST impedir la edición de la configuración de etapas a quien no sea dueño (los agentes solo mueven tarjetas y asignan).
- **FR-012**: El sistema MUST impedir eliminar una etapa que contiene tratos sin antes reubicarlos, evitando tratos huérfanos.
- **FR-013**: Los cambios de configuración de etapas MUST reflejarse en el tablero para todos los miembros de la organización.

**Arrastrar y desplazar (US3)**

- **FR-014**: Los usuarios MUST poder mover un trato entre etapas arrastrándolo (clic-y-arrastrar) y soltándolo en la columna destino, persistiendo igual que con los botones.
- **FR-015**: El sistema MUST conservar los botones de etapa anterior/siguiente como alternativa accesible al arrastre.
- **FR-016**: Si una tarjeta se suelta fuera de una columna válida, el sistema MUST cancelar el movimiento sin cambios.
- **FR-017**: El tablero MUST permitir desplazamiento horizontal entre columnas y desplazamiento vertical dentro de cada columna de forma cómoda con el mouse.

**Panel de detalle (US4)**

- **FR-018**: Al activar una tarjeta (clic sin arrastre), el sistema MUST abrir un panel de detalle del trato.
- **FR-019**: El panel MUST mostrar datos reales del cliente (nombre, teléfono, badge del canal de origen), sus requisitos de búsqueda, la propiedad relacionada del trato y un resumen de los últimos mensajes de la conversación.
- **FR-020**: El panel MUST ofrecer "Abrir en bandeja" que lleve a la conversación del cliente en la bandeja; el pipeline NO reimplementa las reglas de canal ni la ventana de 24 h (las decide la bandeja).
- **FR-021**: El panel MUST ofrecer un enlace a la ficha de la propiedad cuando el trato tenga propiedad; desactivarlo cuando no.
- **FR-022**: Cuando falte un dato (sin requisitos, sin propiedad, sin conversación), el panel MUST mostrar un estado vacío claro en lugar de fallar.

**Asignación de agente (US5)**

- **FR-023**: Los usuarios MUST poder asignar o reasignar un trato a un miembro de la organización (owner o agent) desde la tarjeta o el panel.
- **FR-024**: El sistema MUST rechazar asignar un trato a un usuario que no sea miembro de la organización.
- **FR-025**: El sistema MUST permitir el estado "Sin asignar" y mostrarlo de forma explícita.
- **FR-026**: La tarjeta MUST reflejar el agente asignado (avatar/inicial) o "Sin asignar", y los cambios MUST persistir.

**Auto-alta y regla de avance de las automatizaciones**

- **FR-029**: Las **automatizaciones** que cambian la etapa de un trato (hoy: agendar una visita; en el futuro, el clasificador IA de la feature 011) MUST mover el trato **solo hacia adelante** en el orden de etapas; **nunca lo retroceden** automáticamente. El retroceso (mover una tarjeta a una etapa anterior) queda reservado a la acción **manual** del usuario (arrastre/chevron).
- **FR-030**: Agendar una visita MUST llevar el trato del cliente↔propiedad a la etapa ancla "Visita agendada" **solo si su etapa actual es anterior** a esa ancla; si el trato ya está igual o más adelante, su etapa **no cambia** (regla de avance, FR-029). Si el cliente solo tenía un trato sin-propiedad (auto-alta por inbound) y aún no había trato para esa propiedad, ese trato se **promueve** (se le asocia la propiedad) en vez de duplicar la tarjeta.

**Transversales**

- **FR-027**: Todas las operaciones de lectura y escritura MUST estar autorizadas por la membresía del usuario en la organización activa (owner+agent), con aislamiento de tenant por defecto.
- **FR-028**: Ante movimientos o asignaciones inválidos (etapa inexistente, no-miembro, concurrencia), el sistema MUST fallar de forma segura (rechazar y reflejar el estado real) sin corromper datos ni duplicar tratos.

### Key Entities *(include if feature involves data)*

- **Etapa de embudo (configurable por organización)**: una columna del Kanban. Atributos: etiqueta visible, orden, tipo (ancla *ganado* / ancla *perdido* / ancla *visita* / intermedia), si es eliminable. Conjunto ordenado y propio de cada organización; sembrado por defecto con las etapas actuales. Relación: muchas etapas por organización; cada trato referencia una etapa de su organización.
- **Trato (candidatura)**: la unidad del pipeline = un cliente negociando (opcionalmente) una propiedad. Atributos: etapa actual, agente asignado (opcional), marca de tiempo. Reusa la entidad de candidatura existente. Un cliente puede tener varios tratos (uno por propiedad). La propiedad es opcional para etapas tempranas. Relación: pertenece a una organización, un cliente, opcionalmente una propiedad, opcionalmente un agente; referencia una etapa.
- **Cliente**: persona del trato (reusa entidad existente, feature 009). Aporta nombre, teléfono, canal de origen, requisitos y conversación para el panel de detalle.
- **Propiedad**: inmueble relacionado al trato (reusa entidad existente, feature 007); puede no existir aún.
- **Conversación**: hilo de WhatsApp del cliente (reusa entidad existente); el panel muestra un resumen y deep-linkea a la bandeja.
- **Miembro/Agente**: usuario de la organización (owner/agent) candidato a ser asignado; la asignación valida pertenencia a la organización.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los tratos mostrados en el tablero corresponden a la organización activa; cero fugas entre organizaciones en las pruebas de aislamiento.
- **SC-002**: Un trato movido a otra etapa (por arrastre o por botón) permanece en la nueva etapa tras recargar y para cualquier otro miembro de la agencia (persistencia verificable al 100 %).
- **SC-003**: Un dueño puede renombrar y reordenar una etapa intermedia y ver el tablero reflejarlo (propio y de otro miembro) tras un refresco; un agente no encuentra forma de editar la configuración.
- **SC-004**: Intentar eliminar una etapa ancla o eliminar una etapa con tratos sin reubicarlos se rechaza el 100 % de las veces con un mensaje claro.
- **SC-005**: Abrir cualquier tarjeta muestra los datos reales del cliente correspondiente, y "Abrir en bandeja" lleva a su conversación correcta (sin abrir la de otro cliente).
- **SC-006**: Asignar un trato a un miembro válido persiste; asignar a un no-miembro se rechaza el 100 % de las veces.
- **SC-007**: Mover una tarjeta por arrastre requiere una sola acción de clic-y-arrastrar y refleja el cambio visualmente de inmediato; soltar fuera de una columna válida no produce ningún cambio.
- **SC-008**: Una agencia sin configurar su embudo ve exactamente las etapas por defecto actuales (cero cambios visibles respecto a hoy hasta personalizar).

## Assumptions

- **Reuso de entidades existentes**: el trato reusa la entidad de candidatura (cliente + propiedad + etapa + agente, ya con aislamiento por organización); el panel de detalle reusa cliente, requisitos, conversación y propiedad. No se crean canales ni se duplica lógica de la bandeja.
- **La bandeja es la dueña de las reglas de canal**: "Abrir en bandeja" es un deep-link; el pipeline no reimplementa texto-libre vs. plantilla ni la ventana de 24 h (misma decisión que la feature 009).
- **Propiedad opcional en el trato**: se asume que un trato puede existir sin propiedad en etapas tempranas (la entidad de candidatura pasa a admitir propiedad ausente). Decisión del dueño: la tarjeta es un "trato" cliente+propiedad y un mismo cliente puede tener varias tarjetas.
- **Etapas por organización**: las etapas dejan de ser una lista global fija y pasan a ser un conjunto configurable por organización, sembrado con las 8 etapas actuales para no alterar el comportamiento visible inicial.
- **Anclas semánticas**: Ganado y Perdido son los estados de cierre que ya consume el dashboard; Visita agendada es el destino de la automatización existente al agendar una visita. Estas tres se preservan para no romper esas dependencias.
- **Roles**: solo el dueño configura etapas; cualquier miembro (owner+agent) mueve tarjetas y asigna agentes, consistente con el patrón `requireMember` del proyecto.
- **Origen de los tratos**: el dueño quiere que **todo inbound aparezca en el pipeline**, así que el
  primer mensaje entrante de un contacto **auto-crea** un trato sin-propiedad en la etapa inicial (extiende
  el auto-alta de 009); además se ofrece el alta manual desde el pipeline. La **clasificación/movimiento
  por IA** se difiere a la feature 011; en 010 el movimiento es manual + la automatización de visita con
  **regla de avance** (solo hacia adelante).
- **Tiempo real**: la sincronización entre miembros se asume por refresco/polling (consistente con la abstracción de realtime ya existente), no necesariamente instantánea; la concurrencia se resuelve "gana el último" sin corromper estado.

## Out of Scope

- **Clasificación agéntica de etapa por IA con prompt editable → feature 011** (siguiente slice). 010 deja
  listo el **auto-alta de trato por inbound** y la **regla de avance** (FR-029/FR-030) sobre los que 011
  construirá: un modelo barato (p. ej. `google/gemini-2.5-flash-lite`) que lee la conversación y **avanza**
  el trato en el embudo según un prompt de clasificación **configurable por agencia**, respetando las etapas
  configurables de 010 y sin auto-cerrar a Ganado/Perdido sin control. En 010 el movimiento del embudo es
  **manual** (arrastre/chevron) + la automatización de visita.
- Rehacer o embeber la bandeja dentro del pipeline (solo se deep-linkea a ella).
- Nuevas automatizaciones de cambio de etapa más allá de la de visita ya existente (las agénticas son 011).
- Reportes o analytics nuevos del embudo (el dashboard de cierres ya existe y se mantiene).
- Incluir Instagram u otros canales en el pipeline (el trato es del CRM, no por canal).
- Reglas de permisos granulares por etapa o por agente más allá de owner/agent.
