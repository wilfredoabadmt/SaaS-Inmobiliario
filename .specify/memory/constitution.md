<!--
SYNC IMPACT REPORT
==================
Version change: 1.2.0 → 1.3.0
Tipo de cambio: MINOR (adición de un principio nuevo)

Historial de versiones:
  - 1.0.0 (2026-06-07): Ratificación inicial con 7 principios.
  - 1.1.0 (2026-06-07): Añadido Principio VIII "Foco Vertical Inmobiliario"
    (define el dominio del producto —agencias inmobiliarias— y el alcance de v1).
  - 1.2.0 (2026-06-07): Modificado Principio II "Soberanía / Self-Hosted". Las
    funciones core (auth, BD relacional) siguen siendo self-hosted obligatorio;
    el almacenamiento de objetos PUEDE ser externo vía interfaz S3 estándar
    (p. ej. Cloudflare R2), portable a MinIO sin cambios de código. Ajustada la
    sección "Restricciones de Plataforma y Seguridad" para coherencia. Se trata
    como MINOR porque preserva la intención de soberanía (migración self-hosted
    sin reescribir código), no como redefinición incompatible (MAJOR).
  - 1.3.0 (2026-06-29): Añadido Principio IX "Verificación de Comportamiento en
    Vivo (NO NEGOCIABLE)", que complementa al Principio V: para TODA feature con
    comportamiento observable (UI web, mensajería, API o integración externa),
    "Hecho" exige además un self-test E2E ejecutado por el implementador tras la
    implementación (camino feliz + infeliz), con loop de auto-corrección hasta verde
    (self-improvement loop); se conduce la interfaz real (Playwright para UI,
    Evolution API para mensajería); preferencia por probar en local antes que en la
    nube; y guardarraíles duros (allowlist, anti-ráfaga) al usar herramientas no
    oficiales sobre un número real. Se trata como MINOR porque añade un principio
    nuevo sin redefinir ni eliminar otros. Eleva a regla constitucional el loop de
    self-test post-implementación que antes vivía solo en CLAUDE.md, las skills
    (loop-sdd) y la memoria del proyecto.

Principios definidos (9):
  - I.    Seguridad de Datos Primero (NO NEGOCIABLE)
  - II.   Soberanía / Self-Hosted        <- MODIFICADO en 1.2.0
  - III.  Multi-Tenancy Real
  - IV.   Idempotencia en Integraciones Externas
  - V.    Calidad Verificable Antes de "Hecho" (NO NEGOCIABLE)
  - VI.   Specs Antes de Código
  - VII.  Trazabilidad de Decisiones
  - VIII. Foco Vertical Inmobiliario     <- añadido en 1.1.0
  - IX.   Verificación de Comportamiento en Vivo (NO NEGOCIABLE) <- añadido en 1.3.0

Principios modificados: ninguno
Secciones añadidas: Principio IX "Verificación de Comportamiento en Vivo"
Secciones modificadas: ninguna
Secciones eliminadas: ninguna

Plantillas dependientes:
  - .specify/templates/plan-template.md ........ ✅ alineada (la "Constitution Check"
    referencia dinámicamente este archivo; el gate de comportamiento se evalúa por
    feature; sin edición requerida)
  - .specify/templates/spec-template.md ........ ✅ alineada (genérica; los criterios
    de aceptación observables ya soportan el self-test E2E del Principio IX)
  - .specify/templates/tasks-template.md ....... ✅ alineada (genérica; la tarea de
    verificación de comportamiento encaja en la categoría de pruebas existente)
  - .specify/templates/commands/*.md ........... N/A (no existe; comandos son skills)
  - README.md / docs/quickstart.md ............. N/A (no existen)

TODOs diferidos: ninguno
-->

# WhatsApp CRM SaaS Constitution

CRM SaaS multi-tenant para WhatsApp Business. Esta constitución define las reglas
no negociables del producto. Aplica a todas las fases posteriores del flujo de
trabajo (specify, plan, tasks, implement). Cualquier conflicto entre una decisión
de implementación y esta constitución SE RESUELVE A FAVOR de esta constitución.

## Core Principles

### I. Seguridad de Datos Primero (NO NEGOCIABLE)

La protección de datos es la primera responsabilidad del sistema, por encima de
velocidad de entrega o conveniencia de desarrollo.

- Los tokens, credenciales y secretos sensibles NUNCA se exponen al cliente
  (navegador, app, respuestas de API) ni se escriben en logs, trazas o mensajes
  de error.
- Todo secreto se almacena cifrado en reposo. Las claves de cifrado se gestionan
  fuera del código fuente y fuera del control de versiones.
- Todo dato de un tenant está aislado de los demás tenants. Ninguna consulta,
  endpoint o tarea en segundo plano debe poder devolver o modificar datos de un
  tenant distinto al del solicitante. El aislamiento se aplica por defecto, no
  como excepción opt-in.

**Rationale**: Una fuga de credenciales de WhatsApp Business o un cruce de datos
entre clientes es un fallo catastrófico e irreversible para un CRM SaaS; el coste
de prevenirlo siempre es menor que el de remediarlo.

### II. Soberanía / Self-Hosted

El producto MUST poder operar sobre infraestructura propia, sin depender de
servicios SaaS de terceros para sus funciones core.

- Las funciones CORE —autenticación y base de datos relacional— MUST ser
  self-hosted en infraestructura propia. Depender de un tercero para una función
  core es una violación que debe justificarse explícitamente en el Complexity
  Tracking del plan y documentar una alternativa self-hosted.
- El almacenamiento de objetos (archivos, documentos, imágenes) MAY usar un
  servicio externo compatible con el protocolo S3 (p. ej. Cloudflare R2),
  SIEMPRE QUE el código acceda a él a través de la interfaz S3 estándar, de modo
  que migrar a una alternativa self-hosted (p. ej. MinIO) no requiera cambios de
  código. Acoplarse a APIs propietarias no-S3 del proveedor es una violación.
- Las integraciones externas inevitables (p. ej. la API de WhatsApp Business)
  se aíslan tras una frontera clara para no acoplar el core a ellas.

**Rationale**: La soberanía sobre datos e infraestructura es un diferenciador del
producto y un requisito para clientes con restricciones de residencia de datos.
Las funciones core permanecen self-hosted para preservarla; el almacenamiento de
objetos se exceptúa porque, en un MVP sobre un VPS de bajos recursos,
externalizarlo evita sobrecargar el servidor y sus backups — y exigir la interfaz
S3 estándar garantiza que esa externalización sea reversible sin reescribir código.

### III. Multi-Tenancy Real

El sistema sirve a múltiples organizaciones independientes desde una sola
instancia lógica.

- Cada organización (tenant) gestiona sus propios usuarios.
- Los usuarios tienen roles y permisos definidos por su organización; el acceso a
  cualquier recurso se evalúa contra el rol del usuario dentro de su tenant.
- El identificador de tenant es un parámetro de primer nivel en el modelo de
  datos y en la capa de acceso a datos, no un campo opcional añadido a posteriori.

**Rationale**: Multi-tenancy diseñado desde el inicio evita reescrituras costosas
y es la condición que hace cumplible el aislamiento del Principio I.

### IV. Idempotencia en Integraciones Externas

Todo evento entrante de un sistema externo (webhooks de WhatsApp, callbacks de
pago, notificaciones de terceros) se procesa de forma idempotente.

- Recibir el mismo evento dos o más veces NO duplica efectos observables (mensajes
  reenviados, cargos repetidos, registros duplicados).
- Cada evento entrante se identifica de forma única y su procesamiento se registra
  para detectar y descartar reintentos.

**Rationale**: Los proveedores externos reintentan entregas por diseño; sin
idempotencia, los reintentos corrompen datos y generan acciones duplicadas
visibles para el cliente final.

### V. Calidad Verificable Antes de "Hecho" (NO NEGOCIABLE)

Ninguna tarea se considera terminada sin pasar verificación automática.

- "Hecho" requiere que pasen, como mínimo: comprobación de tipos, lint y build; y
  tests donde apliquen al alcance de la tarea.
- Todo aquello que NO se pueda verificar automáticamente se marca explícitamente
  como "pendiente de verificación humana" en la tarea o el PR; no se reporta como
  completado sin esa marca.
- No se reporta una tarea como terminada describiendo que "debería funcionar":
  o pasa la verificación, o se declara su estado real (incluyendo fallos).

**Rationale**: La verificación automática es la única definición de "hecho" que no
depende de optimismo; declarar explícitamente lo no verificable evita falsos
positivos de completitud.

### VI. Specs Antes de Código

Ninguna feature se implementa sin una especificación previa.

- La especificación describe el comportamiento observable por el usuario, no la
  implementación.
- El orden del flujo es specify → plan → tasks → implement; el código de una
  feature no comienza antes de existir su spec.
- Correcciones triviales y cambios sin comportamiento observable nuevo (typos,
  formato, refactors internos sin cambio de contrato) están exentos.

**Rationale**: Especificar el comportamiento observable antes de codificar previene
retrabajo, hace las features testeables y mantiene alineadas todas las fases del
flujo de trabajo.

### VII. Trazabilidad de Decisiones

Las decisiones tomadas sin contexto suficiente se documentan para revisión humana.

- Cuando una decisión se toma con información incompleta o supuestos no
  confirmados, se registra de forma visible (en el spec, el plan, el PR o un
  marcador `NEEDS CLARIFICATION` / TODO con responsable), no se entierra en el
  código.
- Los supuestos que condicionan el comportamiento se hacen explícitos para que un
  humano pueda revisarlos y revertirlos.

**Rationale**: Las decisiones implícitas tomadas bajo incertidumbre son la
principal fuente de deuda oculta; hacerlas visibles permite corregirlas antes de
que se conviertan en supuestos enterrados.

### VIII. Foco Vertical Inmobiliario

Este producto sirve específicamente a agencias inmobiliarias. Es un CRM
inmobiliario, no una herramienta genérica de mensajería.

- El modelo de datos y los flujos MUST reflejar el dominio inmobiliario real:
  propiedades, contratos, citas de muestra (visitas) y evaluación de candidatos
  (prospectos a comprar o rentar).
- WhatsApp es el canal principal de comunicación, pero no define la naturaleza del
  producto: el producto es el CRM inmobiliario y WhatsApp es uno de sus canales.
- Toda feature MUST servir a una agencia inmobiliaria gestionando propiedades y
  clientes. Cualquier feature que no cumpla esa condición queda FUERA del alcance
  de v1.

**Rationale**: Un foco vertical explícito impide que el producto derive hacia una
herramienta de mensajería genérica, mantiene el modelo de datos alineado con el
negocio inmobiliario real y da un criterio claro y verificable para aceptar o
rechazar alcance en v1.

### IX. Verificación de Comportamiento en Vivo (NO NEGOCIABLE)

Complementa el Principio V. TODA feature con comportamiento observable —UI web,
mensajería, API o integración externa— se verifica ejerciendo ese comportamiento como
lo haría un usuario real antes de declararse "Hecha". El gate técnico (Principio V) es
el piso, no el techo.

- **Self-test + loop por el implementador.** Tras la fase de implementación, quien
  implementa ejecuta el self-test E2E —camino feliz Y camino infeliz (degradación sin
  colgarse)— y, si algo falla, diagnostica, corrige y re-verifica él mismo hasta verde
  (self-improvement loop). No se entrega trabajo a medio verificar ni se delega la
  prueba funcional al dueño. Lo único delegable a verificación humana es lo
  intrínsecamente no verificable por herramientas (juicio visual, aprobación de un
  tercero como Meta), marcado explícitamente.
- **Se conduce la interfaz real.** Navegador vía Playwright para features de UI;
  WhatsApp (Evolution API) para mensajería; llamadas a la API donde esa sea la
  superficie. No basta con tipos/lint/build, ni con que un endpoint devuelva 2xx, ni
  con inspeccionar la base de datos: se observa el resultado de cara al usuario.
- **Local primero, nube después.** Si el comportamiento puede reproducirse en
  `localhost` —incluyendo integraciones externas vía túnel (p. ej. ngrok + handshake
  del webhook desde el panel del proveedor)—, SHOULD probarse ahí antes de desplegar.
  El deploy a la nube (Coolify) se reserva preferentemente para lo que el entorno
  local no pueda reproducir, porque desplegar consume tiempo y reduce la agilidad del
  ciclo de iteración.
- **Guardarraíles con herramientas no oficiales.** Cuando la prueba use herramientas
  no oficiales (p. ej. Evolution API) vinculadas a un número real/personal, MUST
  respetarse reglas duras para no arriesgar ese número: enviar solo a destinatarios
  declarados en una allowlist, NUNCA mensajes en ráfaga (anti-flood / throttling
  obligatorio), y minimizar el volumen al mínimo necesario para verificar. La
  integridad del número personal del operador es un activo a proteger, en línea con
  el Principio I.

**Rationale**: El gate técnico no detecta que el agente "se calló", que una tarjeta no
llegó como un solo mensaje, o que un botón/flujo de UI no disparó nada — eso solo
aparece ejerciendo el flujo real, sea por navegador o por mensajería. Y el valor del
paso no está solo en detectar el fallo sino en cerrarlo: el implementador itera hasta
verde en vez de devolver trabajo a medias. Probar en local primero mantiene el ciclo
ágil y barato; reservar la nube para lo irreproducible evita quemar tiempo de deploy.
Y como el self-test puede depender de herramientas no oficiales sobre un número real,
sin guardarraíles duros la propia prueba podría provocar un baneo — un coste
irreversible.

## Restricciones de Plataforma y Seguridad

Estas restricciones derivan de los Principios I y II y son verificables en revisión:

- **Gestión de secretos**: los secretos se inyectan vía configuración de entorno o
  un gestor de secretos self-hosted; nunca se comprometen a control de versiones.
- **Cifrado en reposo**: credenciales y datos sensibles de tenant se almacenan
  cifrados; el almacenamiento en claro de secretos es una violación.
- **Frontera de tenant**: la capa de acceso a datos exige el identificador de
  tenant; cualquier acceso que pueda omitirlo requiere justificación explícita y
  revisión.
- **Independencia del core**: auth y base de datos relacional corren sobre
  infraestructura controlada por el operador del producto. El almacenamiento de
  objetos puede ser externo únicamente a través de la interfaz S3 estándar
  (portable a MinIO self-hosted sin cambios de código).
- **Aislamiento de integraciones**: las dependencias de APIs externas se acceden a
  través de adaptadores dedicados, no dispersas por el dominio.

## Flujo de Desarrollo y Puertas de Calidad

- **Orden del flujo**: specify → plan → tasks → implement. Cada fase consume el
  artefacto de la anterior.
- **Puerta constitucional (Constitution Check)**: el plan de cada feature evalúa el
  cumplimiento de estos principios antes de la Fase 0 y se re-evalúa tras el diseño
  de la Fase 1. Las violaciones se registran y justifican en Complexity Tracking o
  se eliminan.
- **Puerta de calidad (Definición de "Hecho")**: tipos + lint + build en verde, y
  tests donde apliquen; lo no verificable automáticamente se marca como pendiente
  de verificación humana (Principio V). Para features con comportamiento observable
  de cara al usuario, "Hecho" exige además el self-test de comportamiento en vivo
  ejecutado por el implementador, con sus guardarraíles (Principio IX).
- **Trazabilidad**: decisiones bajo incertidumbre y supuestos se documentan de
  forma visible (Principio VII), no en comentarios enterrados.

## Governance

Esta constitución es la autoridad máxima del proyecto. Prevalece sobre cualquier
otra práctica, convención o preferencia; ante un conflicto, gana la constitución.

- **Procedimiento de enmienda**: toda enmienda se propone por escrito describiendo
  el cambio y su motivación, se aprueba por el responsable del proyecto y se
  registra en el control de versiones junto con el Sync Impact Report actualizado.
- **Política de versionado** (semantic versioning de la constitución):
  - **MAJOR**: eliminación o redefinición incompatible de un principio o de la
    gobernanza.
  - **MINOR**: adición de un principio/sección nueva o expansión material de una
    guía existente.
  - **PATCH**: aclaraciones, correcciones de redacción y refinamientos no
    semánticos.
- **Revisión de cumplimiento**: cada PR y cada revisión de diseño verifican el
  cumplimiento de estos principios. La complejidad que viole un principio debe
  justificarse; si no puede justificarse, debe eliminarse.
- **Propagación**: al enmendar la constitución se revisan y, si procede, se
  actualizan las plantillas dependientes (plan, spec, tasks) para mantener la
  coherencia.

**Version**: 1.3.0 | **Ratified**: 2026-06-07 | **Last Amended**: 2026-06-29
