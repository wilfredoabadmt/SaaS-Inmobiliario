# Feature Specification: Gestión de plantillas de WhatsApp

**Feature Branch**: `012-whatsapp-templates`

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "El SaaS tiene que tener una sección específica para administrar plantillas de WhatsApp con las operaciones de crear, eliminar, mandar a revisión, etc. Todo para que el agente pueda enviar plantillas cuando la ventana de 24 horas se acaba, y para recordatorios de visita, follow-ups, etc. Conexión directa con Meta llamando a su API. Mostrar el estatus (aprobado/desaprobado) y estadísticas (cuántas plantillas ha enviado, costo, y más)."

## Visión general

Hoy las plantillas de WhatsApp viven como un **registro local** que solo guarda metadata de plantillas
*ya aprobadas* a mano: no se crean contra Meta, no muestran estatus real y no se pueden sincronizar ni
eliminar desde el producto. Esta feature convierte ese registro en una **sección de administración real**:
cada agencia gestiona SUS plantillas hablando directamente con WhatsApp (crear, enviar a revisión,
sincronizar estatus, eliminar), ve el **estatus real** de cada una (aprobada / rechazada / pendiente /
pausada) con su razón de rechazo, y consulta **estadísticas reales** de uso y **costo**. El **envío manual
desde la bandeja** se actualiza para soportar plantillas con **variables** (rellenar los datos al enviar),
que es la vía permitida para escribir al cliente **cuando la ventana de servicio de 24 h ya cerró**.

Esta spec entrega la **base** (plantillas aprobadas, con variables, listas para enviar) sobre la que una
spec posterior construirá los **envíos automáticos** (recordatorios de visita al cliente, re-enganche del
agente fuera de 24 h, follow-ups). Esos automatismos están **fuera de alcance** aquí.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una plantilla y enviarla a revisión (Priority: P1)

El dueño de la agencia abre la sección de Plantillas, crea una plantilla nueva (elige categoría —Marketing /
Utilidad / Autenticación—, idioma, y arma su contenido: encabezado opcional de texto o imagen, cuerpo con
variables como `{{1}}` y valores de ejemplo, pie opcional y botones opcionales) y la **envía a revisión de
WhatsApp** con un clic. La plantilla queda registrada y visible con estatus **"Pendiente"**.

**Why this priority**: Es el corazón de la feature y el primer eslabón sin el cual nada más existe. Sin poder
crear y enviar a revisión una plantilla contra Meta, no hay plantillas aprobadas que enviar ni estatus que
mostrar. Entrega valor por sí sola: el agente puede, por fin, dar de alta plantillas sin salir del producto.

**Independent Test**: Con una agencia que tiene WhatsApp conectado, crear una plantilla válida desde la UI y
verificar que (a) WhatsApp la acepta para revisión, (b) aparece en la lista con estatus "Pendiente" y (c) sus
datos (categoría, idioma, contenido) se guardaron. Verificable de punta a punta sin las demás historias.

**Acceptance Scenarios**:

1. **Given** una agencia con WhatsApp conectado y un usuario con rol owner, **When** crea una plantilla válida
   (nombre único, categoría, idioma, cuerpo con variables y ejemplos) y la envía a revisión, **Then** WhatsApp
   la acepta, la plantilla aparece en la lista con estatus "Pendiente" y se persiste su contenido y categoría.
2. **Given** el formulario de creación, **When** el contenido incumple una regla de WhatsApp (p. ej. variable
   sin valor de ejemplo, nombre duplicado, formato inválido), **Then** el sistema muestra un **mensaje de error
   legible** (traducido del rechazo de WhatsApp) y **no** crea una plantilla fantasma.
3. **Given** un usuario con rol agente (no owner), **When** intenta crear o enviar a revisión una plantilla,
   **Then** el sistema lo **rechaza por permisos** (solo el owner administra plantillas).
4. **Given** una agencia **sin** WhatsApp conectado, **When** intenta crear una plantilla, **Then** el sistema
   indica que debe conectar WhatsApp primero y no intenta llamar a la API.

---

### User Story 2 - Ver y sincronizar el estatus de revisión (Priority: P2)

El dueño vuelve a la sección y ve, para cada plantilla, su **estatus real** (Aprobada / Rechazada / Pendiente
/ Pausada / Deshabilitada), su categoría, idioma y una **vista previa** del contenido. Si una plantilla fue
**rechazada**, ve la **razón**. El estatus se actualiza solo cuando WhatsApp notifica un cambio, y además
existe un botón **"Sincronizar"** para refrescar bajo demanda.

**Why this priority**: La aprobación la decide WhatsApp de forma asíncrona (minutos a 24 h). Sin reflejar el
estatus real, el dueño no sabe qué plantillas puede usar ni por qué una fue rechazada. Es lo que hace
**confiable** la sección, pero es independiente de poder crearlas (US1).

**Independent Test**: Tomar una plantilla recién creada (Pendiente) y, tras la decisión de WhatsApp,
comprobar que el estatus mostrado cambia a Aprobada o Rechazada (vía notificación automática y/o el botón
Sincronizar) y que, si fue rechazada, se muestra la razón.

**Acceptance Scenarios**:

1. **Given** una plantilla en "Pendiente", **When** WhatsApp aprueba la plantilla, **Then** la sección la
   muestra como "Aprobada" sin intervención manual (notificación entrante) y queda disponible para enviarse.
2. **Given** una plantilla rechazada por WhatsApp, **When** el dueño abre la sección, **Then** ve estatus
   "Rechazada" **y la razón** del rechazo.
3. **Given** cualquier plantilla, **When** el dueño pulsa "Sincronizar", **Then** el sistema consulta a
   WhatsApp y refleja el estatus vigente de todas las plantillas de la agencia.
4. **Given** una notificación de cambio de estatus que ya fue procesada, **When** llega de nuevo (reintento),
   **Then** el sistema **no** la duplica ni corrompe el estado (idempotente).

---

### User Story 3 - Enviar una plantilla aprobada con variables desde la bandeja (Priority: P2)

Un asesor está en una conversación cuya **ventana de 24 h ya cerró** (no puede mandar texto libre). Elige una
plantilla **aprobada**, rellena sus **variables** (p. ej. nombre del cliente, fecha/hora, propiedad) con una
vista previa de cómo quedará, y la envía. El mensaje llega al cliente y queda registrado en el hilo.

**Why this priority**: Es el "para qué" inmediato de tener plantillas: reactivar conversaciones fuera de la
ventana de servicio. Reutiliza el envío de plantilla que ya existe en la bandeja, pero ahora con variables.

**Independent Test**: Con una plantilla aprobada que tiene variables, abrir una conversación fuera de la
ventana de 24 h, rellenar las variables, enviar, y verificar que el mensaje llega al número de prueba con los
valores sustituidos y aparece en el hilo.

**Acceptance Scenarios**:

1. **Given** una conversación fuera de la ventana de 24 h y una plantilla aprobada con variables, **When** el
   asesor rellena las variables y envía, **Then** WhatsApp entrega el mensaje con los valores sustituidos y el
   mensaje queda registrado como saliente en el hilo.
2. **Given** una plantilla aprobada con N variables, **When** el asesor deja una variable vacía, **Then** el
   sistema **no** permite enviar hasta completarlas (validación previa).
3. **Given** una plantilla **no aprobada** (Pendiente / Rechazada), **When** el asesor abre el selector de
   plantillas, **Then** esa plantilla **no** es seleccionable para envío.

---

### User Story 4 - Eliminar una plantilla (Priority: P3)

El dueño elimina una plantilla que ya no usa o que fue rechazada. La plantilla se borra en WhatsApp y
desaparece de la sección.

**Why this priority**: Cierra el ciclo de administración (crear → revisar → usar → **eliminar**), pero no es
crítica para el valor inicial.

**Independent Test**: Eliminar una plantilla existente desde la UI y verificar que (a) WhatsApp confirma el
borrado y (b) deja de aparecer en la sección.

**Acceptance Scenarios**:

1. **Given** una plantilla existente, **When** el owner la elimina, **Then** WhatsApp confirma el borrado y la
   plantilla desaparece de la lista.
2. **Given** una plantilla ya enviada en conversaciones pasadas, **When** se elimina, **Then** **no** se borran
   los mensajes históricos que la usaron (se preserva el historial del hilo).
3. **Given** un usuario con rol agente, **When** intenta eliminar una plantilla, **Then** el sistema lo rechaza
   por permisos.

---

### User Story 5 - Estadísticas de uso y costo (Priority: P3)

El dueño abre las estadísticas y ve, por plantilla y para un rango de fechas, cuántos mensajes se **enviaron,
entregaron, leyeron** y (si aplica) **se hizo clic**, junto con el **costo real**. También un resumen
agregado de la agencia.

**Why this priority**: Es el "sería cool" del dueño: visibilidad y control de gasto. Aporta valor de negocio
pero no es prerrequisito de la operación.

**Independent Test**: Tras enviar algunas plantillas, abrir estadísticas y verificar que los conteos y el
costo coinciden con lo enviado en el rango elegido; cambiar el rango y ver que los números se ajustan.

**Acceptance Scenarios**:

1. **Given** plantillas que se han enviado, **When** el dueño abre estadísticas para un rango de fechas,
   **Then** ve por plantilla los conteos (enviados/entregados/leídos/clics) y el costo correspondiente.
2. **Given** un rango sin datos disponibles aún (ventana de procesamiento de WhatsApp), **When** se abre la
   vista, **Then** el sistema muestra "sin datos todavía" **sin colgarse** ni mostrar números falsos.
3. **Given** datos de estadística, **When** se vuelven a consultar, **Then** se sirven de forma eficiente
   (cacheados) sin re-pegarle a WhatsApp en cada visita.

---

### Edge Cases

- **Token inválido / expirado**: cualquier operación contra WhatsApp (crear, sincronizar, eliminar, enviar,
  estadísticas) detecta el token inválido, marca la conexión como **"requiere reconexión"** y **degrada con
  gracia** (la UI lo informa; no se cuelga ni rompe).
- **WhatsApp caído o error transitorio (5xx)**: la operación falla de forma controlada con mensaje claro y la
  sección sigue navegable; las lecturas (lista, estatus) muestran el último estado conocido.
- **Nombre de plantilla duplicado o inválido** (WhatsApp exige `snake_case`, minúsculas, longitud): error
  legible y sin registro fantasma.
- **Cuerpo inválido** (variable sin ejemplo, demasiados componentes, botón mal formado): validación previa al
  envío + mapeo del rechazo de WhatsApp a un mensaje entendible.
- **Plantilla rechazada**: visible con su razón; no es enviable.
- **Estadísticas sin datos todavía** (retraso de procesamiento de WhatsApp): se muestra vacío explicado, no
  error.
- **Aislamiento de tenant**: una agencia **nunca** ve, sincroniza, envía ni elimina plantillas de otra; todas
  las operaciones están acotadas a la agencia del usuario.
- **Permisos**: un agente (no owner) puede **ver** la sección y **enviar** plantillas aprobadas desde la
  bandeja, pero **no** crear, enviar a revisión, sincronizar ni eliminar.
- **Eliminar una plantilla con envíos históricos**: se preserva el historial de mensajes.
- **Enviar una plantilla no aprobada**: bloqueado en el selector y en el servidor.
- **Variable faltante al enviar**: bloqueado hasta completar.

## Requirements *(mandatory)*

### Functional Requirements

**Administración de plantillas (contra WhatsApp)**

- **FR-001**: El sistema MUST ofrecer una **sección dedicada de Plantillas** donde el usuario ve todas las
  plantillas de su agencia con: nombre, categoría, idioma, estatus, vista previa del contenido y, si aplica,
  razón de rechazo.
- **FR-002**: El sistema MUST permitir **crear** una plantilla definiendo categoría (Marketing / Utilidad /
  Autenticación), idioma, encabezado opcional (texto o imagen), cuerpo con **variables** y **valores de
  ejemplo**, pie opcional y **botones** opcionales (enlace URL / respuesta rápida / llamar), y **enviarla a
  revisión** de WhatsApp en la misma acción.
- **FR-003**: Al crear/enviar a revisión, el sistema MUST llamar a WhatsApp y reflejar el resultado: si se
  acepta, la plantilla queda en estatus **"Pendiente"**; si se rechaza la solicitud, se muestra un **mensaje de
  error legible** y no se crea un registro inconsistente.
- **FR-004**: El sistema MUST mostrar el **estatus real** de cada plantilla con al menos estos estados:
  Aprobada, Rechazada, Pendiente, Pausada, Deshabilitada.
- **FR-005**: El sistema MUST **sincronizar** el estatus con WhatsApp (a) automáticamente al recibir una
  **notificación de cambio de estatus** y (b) **bajo demanda** mediante una acción de "Sincronizar"; el
  procesamiento de notificaciones MUST ser **idempotente** (un reintento no duplica ni corrompe estado).
- **FR-006**: El sistema MUST mostrar la **razón de rechazo** cuando una plantilla esté rechazada.
- **FR-007**: El sistema MUST permitir **eliminar** una plantilla, borrándola en WhatsApp y quitándola de la
  sección, **sin** borrar los mensajes históricos que la usaron.

**Envío manual desde la bandeja**

- **FR-008**: El sistema MUST permitir, desde una conversación, **seleccionar una plantilla aprobada**,
  **rellenar sus variables** (con vista previa del resultado) y **enviarla**; el mensaje enviado queda
  registrado en el hilo como saliente.
- **FR-009**: El sistema MUST ofrecer para envío **únicamente plantillas aprobadas** (las Pendientes /
  Rechazadas / Pausadas no son seleccionables) y MUST **impedir el envío** si falta el valor de alguna variable.
- **FR-010**: El envío de plantilla MUST seguir siendo la vía válida para escribir al cliente **cuando la
  ventana de servicio de 24 h está cerrada** (el envío de plantilla no depende de la ventana).

**Estadísticas**

- **FR-011**: El sistema MUST mostrar, por plantilla y para un **rango de fechas** seleccionable, métricas
  reales de uso: **enviados, entregados, leídos** y **clics** (cuando aplique), más el **costo real**.
- **FR-012**: El sistema MUST presentar también un **resumen agregado** de la agencia (totales y costo).
- **FR-013**: El sistema MUST **cachear** las estadísticas para servirlas eficientemente y MUST mostrar un
  estado **"sin datos todavía" sin error** cuando WhatsApp aún no tenga métricas para el rango.

**Permisos, multi-tenant y robustez**

- **FR-014**: El sistema MUST acotar **todas** las operaciones a la agencia del usuario; una agencia nunca
  accede a plantillas ni estadísticas de otra.
- **FR-015**: El sistema MUST restringir **crear, enviar a revisión, sincronizar y eliminar** al rol **owner**;
  **ver** la sección y **enviar** plantillas aprobadas desde la bandeja está disponible para owner y agente.
- **FR-016**: Toda operación contra WhatsApp MUST **degradar con gracia** ante token inválido/expirado
  (marcando **"requiere reconexión"**) o ante errores transitorios de WhatsApp, sin colgar la UI.
- **FR-017**: El sistema MUST **no** exponer ni registrar el token de acceso de WhatsApp en cliente ni en logs.

**Fuera de alcance (explícito)**

- **FR-018**: El sistema NO implementa en esta feature los **envíos automáticos** (recordatorio de visita al
  cliente por WhatsApp, re-enganche automático del agente al cerrarse la ventana de 24 h, ni follow-ups). La
  feature deja las plantillas aprobadas, con variables y enviables como **base** para esos automatismos.

### Key Entities *(include if feature involves data)*

- **Plantilla**: representa una plantilla de mensaje de la agencia. Atributos clave (sin implementación):
  nombre interno y nombre en WhatsApp, identificador en WhatsApp, categoría, idioma, **estatus**, **razón de
  rechazo**, indicador de calidad, definición de **componentes** (encabezado, cuerpo con variables y ejemplos,
  pie, botones) y marca de última sincronización. Pertenece a una agencia. Extiende el registro local actual.
- **Estadística de plantilla**: métricas de uso y costo de una plantilla en un periodo (enviados, entregados,
  leídos, clics, costo), cacheadas para consulta eficiente. Asociada a una plantilla y a un rango temporal.
- **Conexión de WhatsApp de la agencia** *(existente, reutilizada)*: provee la cuenta de WhatsApp Business y la
  credencial necesarias para todas las operaciones contra WhatsApp; su estado puede pasar a "requiere
  reconexión".
- **Mensaje** *(existente, reutilizado)*: un envío de plantilla desde la bandeja queda registrado como mensaje
  saliente del hilo, enlazado a la plantilla usada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El dueño puede crear una plantilla válida y enviarla a revisión, de principio a fin desde la
  sección, en **menos de 3 minutos** y verla listada como "Pendiente" inmediatamente.
- **SC-002**: El **100 %** de las plantillas creadas en el producto aparecen como pendientes de revisión en la
  cuenta de WhatsApp de la agencia (paridad real con WhatsApp, no solo un registro local).
- **SC-003**: Cuando WhatsApp aprueba o rechaza una plantilla, la sección refleja el nuevo estatus **sin acción
  manual** (vía notificación) y, en su defecto, tras pulsar "Sincronizar"; las rechazadas muestran su razón en
  **el 100 %** de los casos en que WhatsApp la provee.
- **SC-004**: Un asesor puede enviar una plantilla aprobada con variables a un cliente **fuera de la ventana de
  24 h**, con los valores correctamente sustituidos, y verla reflejada en el hilo.
- **SC-005**: Las estadísticas por plantilla (enviados/entregados/leídos/clics y costo) **coinciden** con la
  actividad real del rango consultado; un rango sin datos se muestra como vacío explicado, **sin errores**.
- **SC-006**: Ninguna operación de la sección permite a una agencia ver o afectar plantillas/estadísticas de
  otra (**0** fugas de tenant), y un agente no puede crear/eliminar/sincronizar plantillas (**0** escrituras
  no autorizadas).
- **SC-007**: Ante un token inválido o un fallo transitorio de WhatsApp, la sección **degrada con gracia** (la
  informa y queda navegable) en el **100 %** de los casos provocados, sin pantallas rotas.

## Assumptions

- **Conexión existente reutilizada**: cada agencia ya conecta su cuenta de WhatsApp Business; esta feature
  reutiliza esa conexión (cuenta + credencial cifrada) para todas las llamadas a WhatsApp. No introduce un
  nuevo flujo de conexión.
- **Permiso de gestión de WhatsApp**: gestionar plantillas requiere el permiso de administración de WhatsApp
  Business. En el entorno de **desarrollo/prueba** esto funciona contra la cuenta de prueba; para **producción**
  requiere la **App Review** de Meta (gestionada por separado; ver skills de Meta del proyecto).
- **Aprobación fuera de nuestro control**: la decisión y latencia de aprobación/rechazo de una plantilla la
  toma WhatsApp (de minutos a ~24 h). El paso "queda aprobada" es **pendiente de verificación humana/Meta** en
  el self-test; el producto solo debe **reflejar** el resultado con fidelidad.
- **Retraso de estadísticas**: las métricas y el costo provistos por WhatsApp tienen una ventana de
  procesamiento; "sin datos todavía" es un estado válido y esperado, no un error.
- **Migración aditiva**: se **extiende** el registro de plantillas existente (no se reemplaza de forma
  destructiva) y se agrega almacenamiento de caché de estadísticas. Las plantillas registradas previamente a
  mano conviven con las nuevas (se podrán sincronizar para obtener su estatus real).
- **Administración a nivel de agencia**: las plantillas pertenecen a la cuenta de WhatsApp Business de la
  agencia (no a un usuario individual); por eso la administración la realiza el **owner**.
- **Alcance del editor**: builder práctico que cubre lo que WhatsApp exige para aprobar (categoría, idioma,
  encabezado texto/imagen, cuerpo con variables y ejemplos, pie, botones). Plantillas de catálogo/producto,
  carruseles y flujos avanzados quedan fuera de v1.
- **Automatizaciones diferidas**: recordatorios de visita al cliente, re-enganche automático del agente fuera
  de 24 h y follow-ups se entregan en una spec posterior que reutiliza esta base.
