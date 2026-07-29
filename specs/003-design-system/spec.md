# Feature Specification: Sistema de diseño visual de Inmox

**Feature Branch**: `003-design-system`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Sistema de diseño visual y rediseño de la UI de Inmox basado en el prototipo de alta fidelidad entregado en design_handoff_inmox/ (README.md + Inmox.dc.html). Establecer los design tokens (paleta papel cálida, tipografía Geist, operación venta=teal/renta=bronce, estatus de propiedad/visita, etapas de pipeline, radios, sombras, espaciado, iconografía Lucide) y recrear con fidelidad las pantallas: app shell con riel de iconos de 66px, Bandeja de WhatsApp de 3 columnas con matching en vivo, Dashboard/Inicio con KPIs y SLA, Propiedades (tarjetas/tabla), Pipeline Kanban de 7 columnas, Visitas, Clientes y Configuración. El objetivo es dejar bien acentado el diseño base antes de continuar con el resto de las especificaciones funcionales."

## Resumen

Inmox es un CRM inmobiliario multi-tenant (renta y venta) para inmobiliarias chicas
(2–10 asesores), con WhatsApp como canal central. Esta feature define el **sistema de
diseño visual** del producto y rediseña la UI de la aplicación autenticada para que
coincida con fidelidad con el prototipo de alta fidelidad entregado en
`design_handoff_inmox/` (la fuente de verdad del diseño: `README.md` + `Inmox.dc.html`).

El alcance es **visual y de maquetación**, no de lógica de negocio nueva: se establece
una capa única de design tokens (color, tipografía, espaciado, radios, sombras,
iconografía) y se recrean las pantallas del producto con esa capa, reemplazando el
diseño "básico" actual. La dirección visual es **sobria y cálida**: paleta tipo papel,
acentos de operación desaturados (venta = teal/salvia, renta = bronce), tipografía Geist
con pesos ligeros, bordes hairline y sombras suaves. Idioma: español (México). Solo modo
claro.

El objetivo es dejar el diseño base bien acentado y consistente **antes** de continuar
con el resto de las especificaciones funcionales (matching real, pipeline con datos,
etc.), de modo que esas features se construyan ya sobre el lenguaje visual definitivo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sistema de design tokens único y reutilizable (Priority: P1)

Como equipo que construirá las demás pantallas del CRM, necesito una única fuente de
verdad para los estilos visuales (colores de superficie, tinta de texto, colores de
operación venta/renta, estatus de propiedad y de visita, etapas del pipeline, tipografía
Geist, escala de espaciado, radios, sombras e íconos), de modo que cada pantalla nueva
herede el mismo lenguaje visual sin reinventar valores.

**Why this priority**: Sin una capa de tokens consistente, cada pantalla diverge y el
rediseño se vuelve inmantenible. Es el cimiento sobre el que se apoyan todas las demás
historias y las features funcionales futuras.

**Independent Test**: Se puede verificar de forma independiente revisando que existe una
capa central de tokens que expone todos los valores del handoff (superficies, bordes,
tinta, operación, estatus, etapas, tipografía, radios, sombras) y que una pantalla de
demostración los consume sin valores de color/tamaño "sueltos" hardcodeados fuera de esa
capa.

**Acceptance Scenarios**:

1. **Given** el handoff de diseño con su tabla de tokens, **When** se inspecciona la capa
   de estilos de la aplicación, **Then** existe un token equivalente para cada valor
   nombrado del handoff (paleta papel: page/thread/sunken/card/divider; bordes
   card/control; tinta primary→faintest; operación venta y renta; estatus de propiedad y
   de visita; etapas de pipeline; recibos de chat; ventana 24 h abierta/cerrada).
2. **Given** la tipografía definida, **When** se carga cualquier pantalla, **Then** el
   texto se renderiza con la familia Geist en los pesos y el tracking especificados.
3. **Given** los colores de operación, **When** un elemento representa "venta", **Then**
   usa teal/salvia; **When** representa "renta", **Then** usa bronce; de forma consistente
   en chips, puntos, barras y avatares en todas las pantallas.
4. **Given** un desarrollador construyendo una pantalla nueva, **When** necesita un color,
   radio, sombra o espaciado, **Then** lo toma de la capa de tokens y no introduce un
   valor literal nuevo.

---

### User Story 2 - App shell con riel de iconos (Priority: P1)

Como asesor inmobiliario, quiero un marco de aplicación consistente con un riel de iconos
de navegación a la izquierda que me deje moverme entre las secciones del CRM (Inicio,
Bandeja, Propiedades, Clientes, Pipeline, Visitas, Configuración), de modo que siempre
sepa dónde estoy y pueda cambiar de vista con un clic.

**Why this priority**: El shell es el contenedor de todas las demás pantallas; sin él no
hay navegación coherente. Junto con los tokens, forma el MVP visual mínimo.

**Independent Test**: Se puede probar cargando la app autenticada y verificando que el
riel de 66px aparece fijo a la izquierda con el logo arriba, los botones de navegación,
Configuración y avatar anclados abajo, marcando la sección activa y permitiendo navegar
entre vistas.

**Acceptance Scenarios**:

1. **Given** la app autenticada, **When** se carga cualquier sección, **Then** se muestra
   un riel de iconos vertical fijo de 66px de ancho con el logo de Inmox arriba (38×38,
   radio 10) y los botones de navegación con íconos Lucide.
2. **Given** el riel, **When** una sección está activa, **Then** su botón se muestra con
   estado activo (superficie de tarjeta blanca, tinta primaria, borde control y sombra
   sutil) y los inactivos en transparente con tinta atenuada.
3. **Given** el botón de Bandeja, **When** hay conexión de WhatsApp, **Then** muestra un
   punto verde (online) en la esquina.
4. **Given** el riel, **When** se observa la parte inferior, **Then** Configuración y el
   avatar del usuario quedan anclados abajo (separados del bloque superior).
5. **Given** un clic en un botón de navegación, **When** se selecciona otra sección,
   **Then** el área principal cambia a esa vista y el estado activo se actualiza.

---

### User Story 3 - Bandeja de WhatsApp de 3 columnas con matching en vivo (Priority: P1)

Como asesor, quiero la bandeja de WhatsApp rediseñada en tres columnas (lista de
conversaciones, hilo de chat, y panel de contexto con matching en vivo), de modo que pueda
conversar con clientes, ver la ventana de 24 h, y tener a la vista las propiedades que
mejor encajan con cada cliente para enviarlas sin salir del chat.

**Why this priority**: La bandeja es el corazón del producto (WhatsApp-first) y el panel
de matching es el diferenciador estrella. Es la pantalla con mayor densidad visual y la
que más se beneficia del rediseño.

**Independent Test**: Se puede probar abriendo la bandeja con datos de muestra y
verificando el layout de 3 columnas, la fidelidad de las burbujas/recibos, la franja de
ventana 24 h, y el panel de matching con tarjetas rankeadas, chips de razón y los botones
"¿Por qué?" y "Enviar ficha".

**Acceptance Scenarios**:

1. **Given** la bandeja, **When** se carga, **Then** se distribuye en columnas
   `lista (≈330px fija) + hilo (flexible) + contexto (≈374px fija)` con las superficies y
   bordes del handoff.
2. **Given** la columna de lista, **When** se muestra una conversación, **Then** presenta
   avatar con color de operación e iniciales, badge de no leído, nombre (peso mayor si no
   leído), hora, último mensaje a una línea con elipsis, y chip de operación + propiedad;
   la seleccionada lleva fondo hundido + borde izquierdo del color de operación.
3. **Given** la lista, **When** el asesor usa búsqueda o filtros (Todas / Sin leer /
   Asignadas a mí / Sin asignar), **Then** la lista se filtra en vivo.
4. **Given** el hilo de chat, **When** la ventana de servicio de 24 h está abierta,
   **Then** se muestra una franja verde informativa y el composer permite escribir y
   enviar texto; **When** está cerrada, **Then** la franja es bronce y el composer ofrece
   enviar una plantilla aprobada en lugar de texto libre.
5. **Given** los mensajes, **When** se renderiza el hilo, **Then** hay separadores de
   fecha, burbujas entrante (blanca) y saliente (verde claro) con hora y recibo
   (✓ enviado / ✓✓ gris entregado / ✓✓ teal leído), y una propiedad puede mostrarse como
   ficha-burbuja.
6. **Given** el panel de matching en vivo (columna derecha), **When** hay una conversación
   seleccionada, **Then** muestra los requisitos del cliente como chips y una lista de
   propiedades rankeadas por afinidad, cada una con miniatura, % de match, barra de match
   del color de operación, specs, chips de razón (✓ cumple / ✗ no cumple), botón "¿Por
   qué?" que expande explicación, y botón "Enviar ficha".
7. **Given** una tarjeta de matching, **When** el asesor pulsa "Enviar ficha", **Then** la
   ficha de la propiedad se inserta como mensaje en el hilo y pasa a ser el último mensaje
   de la conversación.

---

### User Story 4 - Dashboard / Inicio con KPIs y banner de SLA (Priority: P2)

Como dueño o asesor, quiero una pantalla de inicio que me dé un saludo, un banner de
alerta cuando hay leads sin responder, los KPIs clave del negocio y un vistazo a la
actividad reciente y las próximas visitas, de modo que sepa de un golpe el estado del día.

**Why this priority**: Aporta valor de panorama pero no es el flujo central diario (la
bandeja lo es). Depende de los tokens y el shell ya definidos.

**Independent Test**: Se puede probar abriendo Inicio con datos de muestra y verificando
el saludo, el banner de SLA, la grilla de KPIs y las dos columnas (actividad reciente /
próximas visitas).

**Acceptance Scenarios**:

1. **Given** Inicio, **When** se carga, **Then** muestra un saludo personalizado con
   fecha/agencia y un acceso "Ir a la bandeja", en un contenedor centrado (máx ≈1180px).
2. **Given** hay leads sin responder por más del umbral, **When** se carga Inicio,
   **Then** aparece un banner de SLA en bronce con el conteo y un acceso "Revisar".
3. **Given** los KPIs, **When** se muestran, **Then** se ven en grilla responsiva: leads
   nuevos, conversaciones activas, visitas de la semana, cierres del mes y sin responder
   (esta última destacada en bronce), cada uno con su número grande.
4. **Given** Inicio, **When** se desplaza, **Then** muestra dos columnas: actividad
   reciente del equipo (avatar + texto + tiempo) y próximas visitas (fecha + cliente +
   propiedad + hora/asesor).

---

### User Story 5 - Propiedades con vista de tarjetas y tabla (Priority: P2)

Como asesor, quiero ver el inventario de propiedades en tarjetas o en tabla, con filtros
por operación y estatus, de modo que pueda explorar el inventario de la forma que me
resulte más cómoda.

**Why this priority**: Es una sección de soporte importante para el matching, pero
secundaria frente a la bandeja en el uso diario.

**Independent Test**: Se puede probar abriendo Propiedades con datos de muestra,
alternando entre Tarjetas y Tabla y aplicando los filtros de operación y estatus.

**Acceptance Scenarios**:

1. **Given** Propiedades, **When** se carga, **Then** muestra título + contador, un toggle
   segmentado Tarjetas/Tabla (activo en negro) y un acceso "Nueva propiedad".
2. **Given** la vista de tarjetas, **When** se muestra una propiedad, **Then** presenta
   foto-gradiente placeholder con badge de estatus y de operación, nombre,
   colonia/ciudad/tipo, precio grande con "MXN" y specs.
3. **Given** la vista de tabla, **When** se muestra, **Then** presenta columnas
   Propiedad · Operación · Zona · Precio · Estatus, con miniatura por fila.
4. **Given** los filtros de operación (Todas/Venta/Renta) y estatus
   (Todos/Disponibles/Apartadas/Cerradas), **When** se activan, **Then** la lista se
   filtra en vivo.

---

### User Story 6 - Pipeline Kanban de 7 columnas (Priority: P2)

Como asesor, quiero un tablero Kanban con las 7 etapas del pipeline y tarjetas de
cliente+propiedad+asesor que pueda mover entre etapas, de modo que vea y gestione el avance
de cada prospecto.

**Why this priority**: Valioso para la gestión comercial pero secundario frente al flujo
de conversación; reutiliza tokens de etapa y de operación.

**Independent Test**: Se puede probar abriendo Pipeline con datos de muestra y moviendo una
tarjeta entre etapas con los controles, verificando el clamp en los extremos.

**Acceptance Scenarios**:

1. **Given** Pipeline, **When** se carga, **Then** muestra un tablero con scroll horizontal
   y 7 columnas (Nuevo → Contactado → Calificado → Visita agendada → Documentación → En
   negociación → Ganado), cada cabecera con punto del color de etapa, label y contador.
2. **Given** una tarjeta, **When** se muestra, **Then** presenta cliente + propiedad +
   asesor y controles ‹ › para mover de etapa.
3. **Given** una tarjeta en la primera o última etapa, **When** se intenta mover más allá,
   **Then** el control correspondiente queda deshabilitado (clamp).

---

### User Story 7 - Visitas y Clientes (Priority: P3)

Como asesor, quiero una lista de visitas (próximas y recientes) con su estado, y un
directorio de clientes con búsqueda, de modo que pueda consultar la agenda de muestras y
los datos de contacto.

**Why this priority**: Secciones de consulta; completan el rediseño pero no son el flujo
principal.

**Independent Test**: Se puede probar abriendo Visitas y Clientes con datos de muestra,
verificando el formato de lista/tabla y la búsqueda en vivo de clientes.

**Acceptance Scenarios**:

1. **Given** Visitas, **When** se carga, **Then** muestra una lista con bloque de fecha +
   cliente (con punto de operación) + propiedad + hora/asesor + chip de estado
   (agendada/realizada/cancelada/no-show) y una nota de cabecera sobre el recordatorio
   automático por WhatsApp.
2. **Given** Clientes, **When** se carga, **Then** muestra título, búsqueda que filtra en
   vivo y una tabla Cliente (avatar+nombre+teléfono) · Interés · Operación · Etapa ·
   Contacto.

---

### User Story 8 - Configuración (estado base) (Priority: P3)

Como usuario, quiero una sección de Configuración accesible desde el riel, de modo que el
shell esté completo aunque su contenido detallado llegue en features posteriores.

**Why this priority**: Cierra el shell de navegación; su contenido funcional está fuera del
alcance de esta entrega de diseño.

**Independent Test**: Se puede probar navegando a Configuración y viendo un estado base
("en construcción") con el lenguaje visual del sistema.

**Acceptance Scenarios**:

1. **Given** el riel, **When** se pulsa Configuración, **Then** se muestra una vista con un
   estado vacío/"en construcción" consistente con los tokens del sistema.

---

### Edge Cases

- **Lista vacía**: ¿qué se muestra cuando no hay conversaciones, propiedades, clientes,
  visitas o tarjetas de pipeline? → estado vacío legible con el lenguaje del sistema, no un
  espacio en blanco.
- **Texto largo**: nombres de cliente, títulos de propiedad y último mensaje deben truncar
  con elipsis sin romper el layout de columnas fijas.
- **Sin propiedad asociada**: una conversación sin propiedad de interés debe degradar de
  forma elegante (sin chip de operación ni matching), no mostrar valores vacíos crudos.
- **Ventana 24 h cerrada**: el composer debe impedir texto libre y guiar hacia plantilla,
  no fallar silenciosamente.
- **Sin foto real**: las propiedades sin imagen usan el gradiente placeholder con ícono de
  casa, no un hueco roto.
- **Viewport angosto**: con columnas fijas (riel 66 + lista 330 + contexto 374), el hilo
  central debe seguir siendo usable; definir el comportamiento mínimo de responsividad.
- **Daltonismo / contraste**: los estados venta/renta y los estatus no deben depender solo
  del color (acompañar con texto/ícono) y deben cumplir contraste de texto legible.

## Requirements *(mandatory)*

### Functional Requirements

**Design tokens (US1)**

- **FR-001**: El sistema MUST exponer una capa única de design tokens que cubra todos los
  valores nombrados en `design_handoff_inmox/README.md`: superficies (page, thread, sunken,
  card, divider-fill), bordes (card, control, avatar-sm), tinta
  (primary, strong, body, muted, faint, faintest), operación (venta y renta: texto, punto,
  chip bg, chip borde, avatar bg), estatus de propiedad (disponible/apartada/cerrada),
  estatus de visita (agendada/realizada/cancelada/no-show), etapas de pipeline (7 puntos de
  color) y colores de chat (burbujas, recibos, online/no leído, franjas de ventana 24 h,
  razones cumple/no cumple).
- **FR-002**: El sistema MUST usar la tipografía Geist (pesos 300–700) con el suavizado y
  tracking del handoff, y aplicar la escala tipográfica definida (h1, sección, KPI, %match,
  nombre, títulos de tarjeta, cuerpo, precios, micro-label).
- **FR-003**: El sistema MUST definir y reutilizar la escala de radios (tarjetas/paneles,
  controles, botones del riel, chips/píldoras full, avatares, miniaturas), las sombras
  (reposo, hover, burbuja, ficha) y la escala de espaciado del handoff.
- **FR-004**: La iconografía MUST usar el set Lucide con el estilo del handoff (stroke 1.8,
  currentColor, linecap/linejoin round) para todos los íconos de navegación y de acción.
- **FR-005**: Los colores de operación MUST aplicarse de forma consistente —venta =
  teal/salvia, renta = bronce— en chips, puntos, barras y avatares en todas las pantallas.
- **FR-006**: Las pantallas rediseñadas MUST consumir los tokens de la capa central y NO
  introducir valores de color/tamaño literales fuera de ella (salvo placeholders explícitos
  como los gradientes de foto).

**App shell (US2)**

- **FR-007**: La aplicación autenticada MUST presentar un app shell con un riel de iconos
  vertical fijo de 66px a la izquierda y el área de contenido ocupando el resto del ancho.
- **FR-008**: El riel MUST contener el logo de Inmox arriba y los accesos de navegación a
  Inicio, Bandeja, Propiedades, Clientes, Pipeline, Visitas y Configuración, con
  Configuración y el avatar del usuario anclados abajo.
- **FR-009**: El riel MUST indicar visualmente la sección activa (estado activo del
  handoff) y permitir navegar entre secciones.
- **FR-010**: El acceso a Bandeja MUST mostrar un indicador de conexión de WhatsApp (punto
  verde) cuando hay número conectado.

**Bandeja + matching (US3)**

- **FR-011**: La bandeja MUST presentarse en 3 columnas (lista de conversaciones ≈330px
  fija · hilo flexible · panel de contexto ≈374px fijo) con las superficies y bordes del
  handoff.
- **FR-012**: La lista de conversaciones MUST mostrar avatar con color de operación, badge
  de no leído, nombre con peso según leído/no leído, hora, último mensaje truncado y chip de
  operación + propiedad; la conversación seleccionada MUST resaltarse con fondo hundido y
  borde izquierdo del color de operación.
- **FR-013**: La lista MUST ofrecer búsqueda (nombre/teléfono/propiedad) y filtros (Todas /
  Sin leer / Asignadas a mí / Sin asignar) que filtran en vivo.
- **FR-014**: El hilo MUST mostrar cabecera (avatar, nombre, chip de operación, teléfono,
  etapa y asesor asignado), una franja de ventana de 24 h (abierta en verde / cerrada en
  bronce), separadores de fecha y burbujas entrante/saliente con hora y recibo de estado.
- **FR-015**: El composer MUST permitir enviar texto y adjuntar cuando la ventana de 24 h
  está abierta, y MUST cambiar a un bloque de envío de plantilla aprobada cuando está
  cerrada; enviar mensaje agrega la burbuja saliente y limpia el input con auto-scroll al
  fondo.
- **FR-016**: El panel de matching en vivo MUST mostrar los requisitos del cliente como
  chips y una lista de propiedades rankeadas por afinidad, cada una con miniatura, % de
  match, barra de match del color de operación, specs, chips de razón (cumple/no cumple),
  un botón "¿Por qué?" que expande la explicación y un botón "Enviar ficha".
- **FR-017**: Al pulsar "Enviar ficha", el sistema MUST insertar la ficha de la propiedad
  como mensaje en el hilo y actualizar el último mensaje de la conversación.
- **FR-018**: El panel de contexto MUST incluir, debajo del matching, los datos del cliente
  (teléfono, correo) y un espacio de notas internas.

**Dashboard (US4)**

- **FR-019**: Inicio MUST mostrar saludo con fecha/agencia, acceso a la bandeja, banner de
  SLA en bronce cuando hay leads sin responder sobre el umbral, una grilla responsiva de
  KPIs (leads nuevos, conversaciones activas, visitas de la semana, cierres del mes, sin
  responder destacado en bronce) y dos columnas (actividad reciente / próximas visitas).

**Propiedades (US5)**

- **FR-020**: Propiedades MUST ofrecer un toggle Tarjetas/Tabla, filtros de operación y de
  estatus que filtran en vivo, y un acceso a "Nueva propiedad".
- **FR-021**: La vista de tarjetas MUST mostrar foto-gradiente placeholder con badge de
  estatus y de operación, nombre, ubicación/tipo, precio con "MXN" y specs; la vista de
  tabla MUST mostrar Propiedad · Operación · Zona · Precio · Estatus con miniatura por fila.

**Pipeline (US6)**

- **FR-022**: Pipeline MUST mostrar un tablero Kanban con scroll horizontal y 7 columnas
  (Nuevo → Contactado → Calificado → Visita agendada → Documentación → En negociación →
  Ganado), cada cabecera con punto de color de etapa, label y contador.
- **FR-023**: Las tarjetas del pipeline MUST mostrar cliente + propiedad + asesor y
  controles para mover de etapa, deshabilitados (clamp) en los extremos.

**Visitas, Clientes, Configuración (US7, US8)**

- **FR-024**: Visitas MUST mostrar una lista de visitas próximas/recientes con fecha,
  cliente (con punto de operación), propiedad, hora/asesor y chip de estado, más una nota
  de cabecera sobre el recordatorio automático por WhatsApp.
- **FR-025**: Clientes MUST mostrar búsqueda en vivo y una tabla
  Cliente · Interés · Operación · Etapa · Contacto.
- **FR-026**: Configuración MUST ser accesible desde el riel y mostrar un estado base
  consistente con el sistema de diseño (contenido funcional fuera de alcance).

**Transversales**

- **FR-027**: Toda la UI MUST estar en español (México) y operar solo en modo claro.
- **FR-028**: Las pantallas MUST manejar estados vacíos, texto largo (truncado con elipsis)
  y datos faltantes (p. ej. conversación sin propiedad) de forma elegante, sin romper el
  layout.
- **FR-029**: Los estados de operación y de estatus MUST distinguirse por algo más que el
  color (texto y/o ícono) y cumplir un contraste de texto legible.
- **FR-030**: El rediseño MUST preservar el comportamiento funcional ya existente de la
  bandeja (carga de mensajes, envío de texto/plantilla, ventana de 24 h) sin regresiones;
  esta feature cambia la presentación, no los contratos de datos.

### Key Entities *(referenciadas por el diseño; no se crean en esta feature)*

- **Conversación**: cliente + propiedad de interés (operación), mensajes (dirección y
  estado de recibo), estado de ventana 24 h, etapa y asesor asignado, indicador de no
  leído. Es el eje de la bandeja.
- **Propiedad**: nombre, operación (venta/renta), ubicación/tipo, precio, specs, estatus
  (disponible/apartada/cerrada) y foto (placeholder gradiente en ausencia de imagen).
- **Requisitos del cliente**: criterios de búsqueda (operación, presupuesto, zona, tipo,
  recámaras, baños) que alimentan el ranking de matching. *(Modelo aún inexistente; se
  representa con datos de muestra en esta feature de diseño.)*
- **Match**: propiedad + porcentaje de afinidad + razones (cumple/no cumple) +
  explicación. Es el contenido del panel de matching.
- **Visita (muestra)**: fecha, cliente, propiedad, hora, asesor y estado
  (agendada/realizada/cancelada/no-show).
- **Lead / tarjeta de pipeline**: cliente + propiedad + asesor + etapa (una de las 7).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un revisor que compare cada pantalla rediseñada lado a lado con el prototipo
  del handoff confirma fidelidad visual en al menos el 95% de los elementos evaluados
  (paleta, tipografía, espaciado, estados de operación y estatus, layout de columnas).
- **SC-002**: El 100% de los valores de color, tipografía, radio, sombra y espaciado
  nombrados en el handoff tienen un token equivalente en la capa central de diseño.
- **SC-003**: Las 8 secciones del shell (Inicio, Bandeja, Propiedades, Clientes, Pipeline,
  Visitas, Configuración, y el propio shell/riel) son navegables y se renderizan con el
  sistema de diseño.
- **SC-004**: Un asesor que ve la bandeja por primera vez identifica, sin ayuda, qué
  conversaciones son de venta vs. renta y cuáles tienen mensajes sin leer, en menos de
  10 segundos.
- **SC-005**: Cero regresiones funcionales en la bandeja existente: cargar mensajes, enviar
  texto dentro de la ventana, y enviar plantilla fuera de la ventana siguen funcionando tras
  el rediseño.
- **SC-006**: La verificación automática (typecheck + lint + build) pasa en verde con el
  rediseño aplicado.
- **SC-007**: Los estados de operación y estatus son distinguibles sin depender solo del
  color (texto/ícono presentes) en el 100% de los componentes que los usan.

## Assumptions

- El prototipo `design_handoff_inmox/` (README.md + Inmox.dc.html) es la **fuente de verdad
  visual**; ante cualquier discrepancia con el diseño actual del código, gana el handoff.
- `Inmox.dc.html` es una referencia de comportamiento y aspecto, **no** código a portar; se
  recrean las pantallas con el stack ya establecido del proyecto (Next.js + Tailwind +
  shadcn/ui, modo claro), reutilizando sus patrones y componentes.
- Esta feature es de **capa de presentación**: no crea entidades de base de datos nuevas ni
  cambia contratos de API. Donde el diseño exige datos que aún no existen (p. ej. requisitos
  del cliente y ranking de matching), se usan **datos de muestra** y se deja el slot listo
  para la feature funcional posterior.
- El matching real (cálculo de afinidad en el backend), el pipeline con persistencia, y la
  captura de requisitos del cliente se especifican en **features posteriores**; aquí solo se
  define su presentación.
- Se mantiene el alcance inmobiliario de la constitución (Principio VIII) y el modo claro y
  el español (México) como decisiones de producto ya tomadas.
- El logo `Inmox logo.png` del handoff es el activo de marca; las fotos de propiedad reales
  llegan después (placeholders por ahora).
- El umbral de "lead sin responder" para el banner de SLA se asume en ~30 minutos
  (consistente con el handoff) y es ajustable; no es objeto de esta feature definirlo de
  forma definitiva.

## Dependencies

- Diseño base: `design_handoff_inmox/README.md` y `design_handoff_inmox/Inmox.dc.html`.
- Tokens previos del proyecto: `specs/001-realestate-whatsapp-crm/design-tokens.md`
  (se reconcilian con el handoff; el handoff prevalece).
- Tipografía Geist (Google Fonts) y librería de íconos Lucide.
- Bandeja funcional existente (feature 001, US1/Comunicación) cuyo comportamiento se
  preserva.
