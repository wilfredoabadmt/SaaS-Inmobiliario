# Feature Specification: Agendamiento de visitas con calendario real (011-visit-scheduling)

**Feature Branch**: `011-visit-scheduling`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: agendamiento de visitas con calendario real ("mini cal.com") para agentes
inmobiliarios independientes — el agente IA de WhatsApp consulta disponibilidad, propone slots, crea,
reprograma y cancela citas; cada asesor configura sus horas hábiles y sincroniza bidireccionalmente con
Google Calendar; el asesor recibe notificaciones por email al agendarse una visita y un recordatorio 1 hora
antes.

## Contexto y antecedentes

Hoy la pantalla **/showings** (Visitas) solo **lista** visitas ya existentes (`showing`) en tarjetas; no hay
noción de **disponibilidad**, **horas hábiles** ni **slots**, y el agente IA solo sabe insertar una visita
con la fecha exacta que el cliente le dicte (`schedule_visit` → `createShowingFromAgent`). Esta feature
convierte esa pantalla en un **calendario real** operado por cada asesor de forma independiente.

**Modelo de equipo (decisión del dueño):** el producto se opera como **SaaS para agentes independientes**.
Cada `user` (asesor, que es `member` de una `organization`) tiene **su propio** calendario, horas hábiles y
agenda. **No** hay políticas de equipo, asignación cruzada ni round-robin entre asesores en esta feature; se
difiere a una fase futura cuando el producto esté probado. El alcance multi-tenant existente se respeta:
todo scoped por `organization_id`, pero la **configuración de calendario y los tokens de Google son por
usuario** dentro de su organización.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El asesor configura sus horas hábiles y disponibilidad (Priority: P1)

Como asesor independiente, quiero definir en la pantalla de Visitas **en qué días y horarios atiendo
visitas**, **cuánto dura cada visita** (slot) y un **margen** opcional entre visitas, para que el sistema
sepa cuándo estoy realmente disponible.

**Why this priority**: Es el cimiento. Sin horas hábiles + duración de slot, no existe "disponibilidad" que
el agente o el motor puedan ofrecer. Es independientemente valioso: aun sin Google ni agente, el asesor ya
ve y controla su ventana de atención.

**Independent Test**: Entrar a /showings → sección de configuración → marcar L–V 10:00–18:00, slot 45 min,
buffer 15 min, timezone America/Mexico_City → guardar → recargar y ver que persiste. Consultar el endpoint
de disponibilidad para una fecha y obtener la lista de slots libres correcta para esa configuración.

**Acceptance Scenarios**:

1. **Given** un asesor sin configuración previa, **When** abre Visitas, **Then** ve una configuración por
   defecto sensata (L–V, 09:00–18:00, slot 60 min, buffer 0, America/Mexico_City) que puede editar.
2. **Given** horas hábiles L–V 10:00–18:00 con slot 45 min y buffer 15, **When** se consulta la
   disponibilidad de un martes sin visitas, **Then** el sistema devuelve slots cada 60 min (45+15) dentro de
   la ventana, sin slots fuera de horario ni en fines de semana.
3. **Given** ya existe una visita el martes 12:00, **When** se consulta la disponibilidad de ese martes,
   **Then** el slot de las 12:00 (y el solapado por su duración) **no** aparece como disponible.
4. **Given** un asesor de otra organización/usuario, **When** consulta disponibilidad, **Then** solo ve su
   propia configuración y sus propias visitas (aislamiento por usuario y por tenant).

---

### User Story 2 - El agente IA propone slots y agenda la visita en WhatsApp (Priority: P1)

Como cliente que chatea por WhatsApp, cuando expreso interés en ver una propiedad, quiero que el agente me
**ofrezca horarios concretos disponibles** y, al elegir uno, **me agende la visita**, para no tener que
adivinar cuándo puede el asesor.

**Why this priority**: Es el corazón de la promesa ("el agente IA llega hasta agendar"). Convierte el
calendario en valor conversacional real. Depende de US1 (disponibilidad) pero es la razón de ser de la
feature.

**Independent Test**: Desde el número de prueba, conversación real: pedir ver una propiedad → el agente
consulta disponibilidad del asesor de esa conversación y responde con 2–3 slots concretos válidos → elegir
uno → el agente confirma y la visita queda creada (aparece en /showings, avanza el pipeline al ancla
`visit`).

**Acceptance Scenarios**:

1. **Given** un cliente con una propiedad de interés y un asesor con disponibilidad, **When** el cliente dice
   que quiere visitarla, **Then** el agente ofrece 2–3 slots concretos **reales** (dentro de horas hábiles y
   libres) en lenguaje natural.
2. **Given** el agente ofreció slots, **When** el cliente elige uno, **Then** se crea la visita reusando la
   lógica existente (asegura candidatura + avanza el pipeline al ancla `visit`, sin retroceder) y el agente
   confirma con la fecha/hora.
3. **Given** una visita ya agendada para ese cliente, **When** el cliente pide **reprogramar**, **Then** el
   agente ofrece nuevos slots y mueve la visita al elegido (sin crear duplicado).
4. **Given** una visita ya agendada, **When** el cliente pide **cancelar**, **Then** el agente marca la
   visita como cancelada y lo confirma.
5. **Given** el modelo devuelve una salida con formato inesperado (no-JSON, vacía), **When** el agente
   procesa el turno, **Then** degrada con extracción robusta / reintento y **no** tumba el turno ni agenda
   algo inválido (regla del proyecto).
6. **Given** el asesor no tiene disponibilidad en los próximos días, **When** el cliente pide visitar,
   **Then** el agente lo comunica con cortesía y/o ofrece el siguiente horario disponible, sin inventar
   slots.

---

### User Story 3 - El asesor recibe notificaciones por email (Priority: P2)

Como asesor, quiero que me **llegue un email** cuando se agenda (o reprograma/cancela) una visita y un
**recordatorio una hora antes** de cada visita, para no perder citas ni depender de revisar el panel.

**Why this priority**: Alto valor operativo (reduce olvidos del asesor) pero no bloquea el flujo de
agendar; por eso P2. El recordatorio al **cliente** queda fuera de alcance (ver Fuera de Alcance).

**Independent Test**: Agendar una visita (manual o por agente) → verificar que llega el email de
confirmación al correo del asesor con cliente, propiedad, fecha/hora y enlace a la bandeja. Forzar la
ventana de "1 hora antes" → verificar que el recordatorio llega exactamente una vez (idempotente).

**Acceptance Scenarios**:

1. **Given** una visita recién agendada, **When** se confirma la creación, **Then** el asesor recibe un
   email con los datos de la visita y un enlace para abrir la conversación en la bandeja.
2. **Given** una visita cuya hora de inicio entra en la ventana "~1 hora antes", **When** corre el proceso
   periódico de recordatorios, **Then** se envía **un** email de recordatorio y no se vuelve a enviar en
   corridas posteriores (idempotente).
3. **Given** una visita reprogramada o cancelada, **When** se confirma el cambio, **Then** el asesor recibe
   un email reflejando el nuevo estado/horario.
4. **Given** un fallo transitorio del envío de email, **When** ocurre, **Then** el agendado **no** se cae por
   eso (el email es best-effort y se registra el fallo, sin romper la operación).

---

### User Story 4 - El asesor conecta Google Calendar (sincronización bidireccional) (Priority: P2)

Como asesor, quiero **conectar mi Google Calendar** para que (a) mis eventos personales ocupados **bloqueen**
la disponibilidad que se ofrece y (b) cada visita agendada en Inmox **aparezca como evento** en mi Google
Calendar (y se mueva/borre si reprogramo/cancelo), para tener una sola agenda confiable y evitar
empalmes.

**Why this priority**: Es el diferenciador "mini cal.com" y elimina el doble-booking, pero el sistema debe
funcionar sin él (degradación local). Por eso P2 y diseñado como aditivo.

**Independent Test**: En Visitas, pulsar "Conectar Google Calendar" → completar OAuth con la cuenta de
prueba → ver estado "conectado". Crear un evento ocupado en Google a una hora → consultar disponibilidad y
confirmar que ese horario **ya no** se ofrece. Agendar una visita en Inmox → confirmar que aparece el evento
en Google Calendar. Reprogramar → el evento se mueve. Cancelar → el evento se borra.

**Acceptance Scenarios**:

1. **Given** un asesor sin Google conectado, **When** consulta disponibilidad, **Then** el sistema degrada a
   "horas hábiles − visitas de Inmox" sin error.
2. **Given** un asesor con Google conectado y un evento ocupado a cierta hora, **When** se calcula
   disponibilidad, **Then** ese horario se excluye (se leen los periodos ocupados de su Google).
3. **Given** un asesor con Google conectado, **When** se agenda/reprograma/cancela una visita en Inmox,
   **Then** el evento correspondiente se crea/actualiza/borra en su Google Calendar (se guarda el
   identificador del evento para poder actualizarlo).
4. **Given** el token de Google del asesor expiró o fue revocado, **When** el sistema intenta usarlo,
   **Then** marca el estado como "reconexión requerida" y degrada (disponibilidad local; la operación de
   Inmox no se cae), mostrando al asesor que debe reconectar.
5. **Given** los tokens de Google, **When** se almacenan, **Then** quedan **cifrados en reposo** y nunca se
   envían al cliente ni aparecen en logs.

---

### Edge Cases

- **Slot ya tomado entre la propuesta y la confirmación**: si el cliente tarda y el slot se ocupa, al
  confirmar el sistema detecta el conflicto y el agente ofrece alternativas (no doble-agenda).
- **Cliente propone una hora fuera de horario / ocupada**: el agente no la acepta; sugiere el slot
  disponible más cercano.
- **Visita en el pasado**: no se permite agendar/reprogramar a un instante ya transcurrido.
- **Timezone**: los slots se calculan y muestran en la timezone configurada del asesor; las comparaciones
  con Google y con la BD se hacen en instantes absolutos (UTC) para evitar desfases.
- **Google desconectado a mitad de operación**: cualquier llamada a Google falla suave → degrada a local +
  estado "reconexión requerida".
- **Recordatorio para visita cancelada**: una visita cancelada no genera recordatorio.
- **Email del asesor ausente/ inválido**: se omite el envío y se registra; no rompe el agendado.
- **Reentrada del cron de recordatorios** (corridas solapadas): la marca de "ya recordado" evita duplicados.
- **Aislamiento de tenant/usuario**: ningún asesor ve disponibilidad, visitas ni tokens de otro.
- **Salida no-JSON / vacía del LLM**: degrada sin tumbar el turno ni marcar error a la primera.

## Requirements *(mandatory)*

### Functional Requirements

**Configuración de calendario (US1)**

- **FR-001**: El sistema MUST permitir a cada asesor configurar sus **horas hábiles** por día de la semana
  (días activos + rango horario inicio/fin por día).
- **FR-002**: El sistema MUST permitir configurar la **duración del slot** (tiempo reservado por visita) y un
  **buffer** opcional entre visitas.
- **FR-003**: El sistema MUST permitir configurar la **timezone** del asesor, con default America/Mexico_City.
- **FR-004**: La configuración MUST ser **por usuario** dentro de su organización y persistente; al no existir
  configuración previa, el sistema MUST asumir un default sensato editable.

**Disponibilidad (US1/US2)**

- **FR-005**: El sistema MUST calcular los **slots disponibles** de un asesor para un rango de fechas como:
  horas hábiles − visitas ya agendadas en Inmox − periodos ocupados de su Google Calendar (si está
  conectado).
- **FR-006**: El cálculo de disponibilidad MUST respetar la duración del slot y el buffer, y NO MUST ofrecer
  slots en el pasado, fuera de horas hábiles, ni solapados con visitas existentes.
- **FR-007**: El sistema MUST exponer la disponibilidad de forma consultable (para el agente y para la UI).
- **FR-008**: Si el asesor no tiene Google conectado, el cálculo MUST degradar a "horas hábiles − visitas de
  Inmox" sin error.

**Agente IA (US2)**

- **FR-009**: El agente IA MUST poder **consultar la disponibilidad** del asesor dueño de la conversación y
  **proponer 2–3 slots concretos válidos** cuando el cliente quiere ver una propiedad.
- **FR-010**: Al elegir el cliente un slot ofrecido, el agente MUST **crear la visita** reutilizando la
  lógica existente (asegura candidatura + avanza el pipeline al ancla `visit` sin retroceder).
- **FR-011**: El agente MUST poder **reprogramar** una visita existente a otro slot disponible sin duplicarla.
- **FR-012**: El agente MUST poder **cancelar** una visita existente.
- **FR-013**: El agente MUST ofrecer **solo** slots realmente disponibles y operar **solo** sobre propertyIds
  reales del tenant (anti-alucinación); cualquier salida del modelo con formato inesperado MUST degradar con
  extracción robusta/reintento sin tumbar el turno ni agendar algo inválido.

**Notificaciones por email (US3)**

- **FR-014**: El sistema MUST enviar un email al **asesor** al **agendarse** una visita (incluyendo cliente,
  propiedad, fecha/hora y enlace a la conversación en la bandeja).
- **FR-015**: El sistema MUST enviar un email al asesor cuando una visita se **reprograma** o **cancela**.
- **FR-016**: El sistema MUST enviar **un** email de **recordatorio ~1 hora antes** de cada visita activa,
  de forma **idempotente** (no reenviar en corridas subsecuentes).
- **FR-017**: El envío de email MUST ser **best-effort**: un fallo de email NO MUST tumbar el agendado ni la
  operación; se registra el fallo.

**Google Calendar (US4)**

- **FR-018**: El sistema MUST permitir a cada asesor **conectar y desconectar** su Google Calendar vía OAuth,
  mostrando el **estado** de la conexión (conectado / reconexión requerida / desconectado).
- **FR-019**: Con Google conectado, el sistema MUST **leer los periodos ocupados** del calendario del asesor
  para excluirlos de la disponibilidad.
- **FR-020**: Con Google conectado, el sistema MUST **crear/actualizar/borrar** el evento en el calendario del
  asesor cuando una visita se agenda/reprograma/cancela, conservando el identificador del evento para
  poder modificarlo.
- **FR-021**: Los tokens de Google (acceso y refresco) MUST almacenarse **cifrados en reposo**, por usuario,
  sin exponerse al cliente ni a logs; el sistema MUST refrescarlos cuando expiren.
- **FR-022**: Si el token es inválido/revocado, el sistema MUST marcar **reconexión requerida** y degradar
  (la operación de Inmox continúa con disponibilidad local) en lugar de fallar.

**Pantalla de Visitas (US1/US4)**

- **FR-023**: La pantalla de Visitas MUST incluir la **configuración de calendario** (horas hábiles, duración
  de slot, buffer, timezone) y el control de **conexión con Google Calendar** con su estado.
- **FR-024**: La pantalla de Visitas MUST mantener el **listado de visitas** existente y, deseablemente,
  ofrecer una vista de **agenda/calendario** del asesor.

**Transversales (constitución)**

- **FR-025**: Toda operación MUST estar scoped por `organization_id` y autorizada vía la sesión del asesor
  (`requireMember`); la configuración y los tokens son adicionalmente por `user`.
- **FR-026**: El proceso de recordatorios MUST autenticarse (token de cron) e ser idempotente.

### Out of Scope (cascarón, NO implementar aquí)

- **OOS-1**: Recordatorios al **cliente** por **plantilla de WhatsApp** o **llamada** para reducir no-show.
  Vive en otra spec (plantillas de Meta). El campo `remindAt` (24h) y el banner actual de la lista quedan
  como **placeholder** de esa feature futura; NO se construye el envío al cliente en 011.
- **OOS-2**: Políticas de **equipo**: asignación entre asesores, round-robin, calendarios compartidos,
  visibilidad cruzada. Fase futura.
- **OOS-3**: Proveedores de calendario distintos de Google (Outlook/iCal).
- **OOS-4**: Email transaccional con dominio propio verificado / múltiples remitentes (se usa un remitente
  único temporal vía SMTP de Gmail).

### Key Entities *(include if feature involves data)*

- **Configuración de calendario (por asesor)**: días y horarios hábiles, duración de slot, buffer, timezone.
  1:1 con el `user` dentro de su organización.
- **Credencial de Google (por asesor)**: tokens cifrados (acceso/refresco), id de calendario, expiración,
  estado de conexión. 1:1 con el `user`.
- **Visita (`showing`, existente, extendida)**: además de lo actual (cliente, propiedad, asesor,
  `scheduledAt`, estado), referencia al **evento de Google** creado y marca de **recordatorio enviado**.
  Se contempla una **duración** efectiva (derivada del slot del asesor al momento de agendar).
- **Disponibilidad (calculada, no persistida)**: conjunto de slots libres de un asesor en un rango.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un asesor puede configurar sus horas hábiles, duración de slot, buffer y timezone, y verlos
  persistir tras recargar, en **menos de 2 minutos** y sin instrucciones técnicas.
- **SC-002**: En una conversación de WhatsApp, el cliente puede pasar de "quiero ver esta propiedad" a
  **visita agendada** ofrecida por el agente en **≤ 4 turnos**, y la visita queda registrada y visible en
  Visitas.
- **SC-003**: El **100%** de los slots ofrecidos por el agente son realmente válidos (dentro de horas
  hábiles, no en el pasado, sin solape con visitas existentes ni con eventos ocupados de Google cuando está
  conectado) — cero doble-bookings en el self-test.
- **SC-004**: Tras agendar, el asesor recibe el email de confirmación; el recordatorio de "1 hora antes" se
  envía **exactamente una vez** por visita (verificable forzando la ventana).
- **SC-005**: Con Google conectado, una visita agendada/reprogramada/cancelada en Inmox se refleja
  correctamente como evento creado/movido/borrado en el Google Calendar del asesor en el self-test.
- **SC-006**: Sin Google conectado, todo el flujo de configurar → proponer slots → agendar → notificar por
  email funciona igual (degradación verificada).
- **SC-007**: Ningún token de Google ni secreto aparece en respuestas al cliente ni en logs; ningún asesor
  accede a la disponibilidad, visitas o credenciales de otro (aislamiento verificado).
- **SC-008**: Cuando el modelo devuelve formato inesperado o el token de Google está expirado, el sistema
  **degrada sin colgarse** (el turno del agente responde; la operación de Inmox no se cae).

## Assumptions

- **A-1**: El envío de email usa, **temporalmente**, la cuenta de Gmail del dueño (tu-correo@gmail.com) como
  remitente único vía SMTP con App Password; migrar a dominio propio/servicio transaccional es trabajo
  futuro fuera de esta spec.
- **A-2**: Existe (o el dueño creará) una app en Google Cloud Console que provee las credenciales OAuth
  (client id/secret) y los scopes de calendario; la cuenta de prueba se agrega como test user mientras la
  app no esté verificada por Google (la verificación de Google es **pendiente de verificación humana**, no
  bloquea el self-test con la cuenta de prueba).
- **A-3**: El "asesor" es el `user`/`member` ya existente; no se introduce un nuevo concepto de usuario.
- **A-4**: La disponibilidad se ofrece sobre el calendario del **asesor dueño de la conversación** (el
  `agentId` que ya resuelve la lógica de showings); no hay selección entre varios asesores.
- **A-5**: El recordatorio de 1 hora se apoya en un proceso periódico frecuente (cron cada pocos minutos);
  la cadencia exacta del scheduler de infraestructura se ajusta en plan/deploy.
- **A-6**: La duración de la visita en Google y en el bloqueo de disponibilidad se deriva del slot
  configurado por el asesor al momento de agendar.
- **A-7**: El stack y la constitución existentes se reutilizan (TS estricto, multi-tenant por
  `organization_id`, cifrado `seal/open` para tokens, patrón de cron con token, migraciones Drizzle
  aditivas).

## Dependencies

- **D-1**: Credenciales OAuth de Google Cloud Console (client id/secret) + scopes de Google Calendar —
  requeridas para US4 (Google). El resto de la feature funciona sin ellas.
- **D-2**: App Password de Gmail para el remitente SMTP — requerida para US3 (emails).
- **D-3**: Lógica existente reutilizada: `showing`/`createShowingFromAgent`, ancla `visit` del pipeline
  (010), guards `requireMember`, cifrado `seal/open`, patrón de cron (`CRON_SECRET`), patrón OAuth/credencial
  por-tenant (Instagram 008).
