# Research & Decisiones: 010-sales-pipeline

Decisiones técnicas bajo incertidumbre (Principio VII). Las **4 decisiones de producto** que cambiaban el
modelo de datos se cerraron con el dueño **antes** del spec (alcance por agencia · anclas fijas + medio
editable · tarjeta = trato cliente+propiedad · panel lateral + deep-link). Aquí se registran las decisiones
**técnicas** derivadas (DV-SP-1…7).

---

## DV-SP-1 — Etapas configurables por organización: enum global → tabla `pipeline_stage`

**Decisión**: Introducir tabla nueva **`pipeline_stage`** (org-scoped, ordenada) y migrar
`candidacy.stage` (hoy `pgEnum candidacyStage`) a **`candidacy.stage_id`** (FK → `pipeline_stage.id`).
Cada organización tiene su propio conjunto de etapas, sembrado por defecto con las 8 actuales.

**Rationale**:
- Un `pgEnum` de Postgres es **global** a la base; no puede variar por tenant. Hacer las etapas
  "configurables por agencia" (decisión del dueño) **exige** moverlas a datos por-org. No hay alternativa
  más simple que cumpla el requisito.
- El rol semántico de las anclas se modela con una columna **`kind`** (`normal` | `won` | `lost` | `visit`),
  no por el `label` (que el owner puede renombrar). Así "Ganado/Perdido/Visita agendada" se resuelven por
  rol, no por texto, y el owner puede renombrar la etiqueta sin romper automatizaciones.
- **Blast radius real medido**: el único literal de etapa en código server es `showings/service.ts`
  (`ensureCandidacy(... stage:"visita_agendada")`). Pasa a `resolveAnchorStage(org,'visit')`. El "dashboard
  de cierres" **hoy es cosmético** (`SAMPLE_KPIS`, sin leer `candidacy`), así que preservar `won`/`lost` es
  para que el futuro dashboard real ya tenga el ancla — no rompe nada vivo.

**Migración (seed-then-map, aditiva, no destructiva)** — orden:
1. `CREATE TABLE pipeline_stage (...)`.
2. **Sembrar** por cada `organization` existente las 8 etapas por defecto (labels/colores desde
   `lib/design/status.ts`), con `kind` mapeado: `visita_agendada→visit`, `ganado→won`, `perdido→lost`,
   resto `normal`, y `sort_order` 0..7.
3. `ALTER TABLE candidacy ADD COLUMN stage_id text` (nullable temporal).
4. `UPDATE candidacy c SET stage_id = ps.id FROM pipeline_stage ps WHERE ps.organization_id =
   c.organization_id AND ps.label = <label-por-defecto-del-enum-de-c.stage>` (join determinista por el
   label sembrado, válido en el instante de la migración antes de cualquier rename).
5. `ALTER COLUMN stage_id SET NOT NULL` + FK + `ON DELETE RESTRICT`; **eliminar** la columna `stage` (enum)
   y opcionalmente conservar el tipo `candidacy_stage` sin uso (drop en limpieza posterior).
6. Para organizaciones nuevas (alta posterior), `seedDefaultStages(orgId)` se invoca de forma **idempotente**
   la primera vez que se accede al tablero / se crea el primer trato (no re-siembra si ya hay etapas).

**Alternativas consideradas**:
- *Mantener `stage` como texto-slug per-org en `candidacy` (sin FK)*: migración más simple (drop del enum,
  dejar `text`), pero pierde integridad referencial (un trato podría apuntar a una etapa borrada) y obliga a
  validar todo en app. Rechazada: el FK `RESTRICT` da la garantía de "no borrar etapa con tratos" (FR-012)
  gratis a nivel BD.
- *Etapas globales con override por org*: complejidad innecesaria; el dueño quiere su propio embudo, no
  parches sobre uno global.

---

## DV-SP-2 — `candidacy.property_id` pasa a nullable (lead temprano sin propiedad)

**Decisión**: `candidacy.property_id` deja de ser `NOT NULL` y admite `NULL`. `ON DELETE` pasa de
`cascade` a **`set null`** (el trato sobrevive si la propiedad se borra; con 007 las propiedades se
**archivan**, no se borran, así que es defensivo). La unicidad se ajusta así:
- Se conserva el unique `(organization_id, client_id, property_id)` para tratos **con** propiedad (un
  cliente, una tarjeta por propiedad concreta).
- Se añade un **unique parcial** `(organization_id, client_id) WHERE property_id IS NULL`: **a lo sumo un
  trato "sin propiedad" por cliente** (evita duplicar el lead temprano del mismo cliente).

**Rationale**: el dueño definió la tarjeta como "trato cliente+propiedad" pero un lead **nuevo** suele no
tener propiedad aún (FR-003/Edge "trato sin propiedad"). Postgres trata los `NULL` como distintos en un
unique normal → permitiría N tarjetas vacías del mismo cliente; el unique parcial lo acota a una. Cuando se
concreta una propiedad, se puede crear un trato nuevo con propiedad (o asociarla al existente).

**Alternativas consideradas**:
- *Exigir propiedad siempre (no nullable)*: obligaría a inventar una propiedad placeholder para cada lead
  nuevo. Rechazada: ensucia el inventario (007).
- *Tabla "deal" separada de `candidacy`*: duplicaría un modelo que ya existe y ya usa `showings`. Rechazada
  por reuso (Principio de no reinventar).

---

## DV-SP-3 — Drag-and-drop: `@dnd-kit/core` (cliente), chevrons como fallback

**Decisión**: usar **`@dnd-kit/core`** para el arrastre: `useDraggable` en la tarjeta, `useDroppable` por
columna; `PointerSensor` + `KeyboardSensor` (accesible). **Activation constraint** (distancia mínima de
arrastre, p. ej. 5px) para **distinguir clic de arrastre**: un clic limpio abre el drawer (DV-SP-4), un
arrastre mueve la tarjeta. Los **chevrons** ‹ › se conservan como alternativa accesible (FR-015). Soltar
fuera de una columna válida = `onDragEnd` sin `over` → no-op (FR-016).

**Scroll (FR-017)**: el contenedor del tablero `overflow-x-auto` (scroll horizontal entre etapas); el
**cuerpo de cada columna** pasa a `flex-1 overflow-y-auto` con altura acotada para que la rueda del mouse
haga scroll vertical cómodo (hoy las columnas no tienen scroll interno y la rueda no responde bien).

**Rationale**: el dueño se quejó explícitamente de que el tablero actual es incómodo (solo botones, scroll
duro) y quiere arrastre **cómodo**. `@dnd-kit` es la opción mantenida y compatible con React 19, con soporte
pointer/touch y **accesibilidad por teclado** integrada — encaja con conservar el fallback. No requiere
reordenar tarjetas **dentro** de una columna (el spec solo pide mover **entre** etapas), así que basta
droppable-por-columna; no se necesita `@dnd-kit/sortable`.

**Alternativas consideradas**:
- *HTML5 DnD nativo (cero dependencias)*: suficiente para columna→columna y sin dep nueva, pero UX pobre en
  touch y arrastre tosco; contradice el objetivo de "cómodo". Rechazada por experiencia.
- *react-beautiful-dnd*: sin soporte sano para React 18/19 (proyecto en mantenimiento). Rechazada.

**Nota constitucional**: `@dnd-kit/core` es una librería **solo cliente** (UI); no afecta soberanía
(Principio II, que aplica al core auth/BD), igual que ya se usan Tailwind/shadcn/lucide.

---

## DV-SP-4 — Panel de detalle (drawer) reusa datos existentes + deep-link a bandeja

**Decisión**: el panel es un **drawer lateral** que compone lecturas ya existentes, sin duplicar lógica:
- **Cliente** (009): `name`, `phone`, badge de `channel` (reusa el componente de badge de canal de 009).
- **Requisitos** (004): `client_requirements` del cliente (operación, presupuesto, zona, etc.).
- **Propiedad** (007): la propiedad del trato + **foto principal** vía URL prefirmada `getDownloadUrl`
  (menor `sortOrder`); enlace a la ficha. Si el trato no tiene propiedad → estado vacío + enlace deshabilitado.
- **Conversación**: resumen de los **últimos N mensajes** (p. ej. 5) del hilo del cliente. **"Abrir en
  bandeja"** llama/garantiza la conversación con **`getOrCreateConversation`** (009) y navega a
  `/inbox?c=<conversationId>`. El pipeline **no** reimplementa texto-libre vs. plantilla ni la ventana 24h
  (las decide la bandeja — misma decisión que 009).

**Rationale**: todo el dato que el dueño quiere ver ("información del cliente y de la conversación, y la
propiedad relacionada") **ya existe**; el trabajo es de composición + UI, no de backend nuevo. Reusar
`getOrCreateConversation` evita divergencia con la bandeja.

**Alternativas consideradas**:
- *Hilo de chat completo embebido* (la opción que el dueño descartó): duplicaría la bandeja en dos lugares.
  Rechazada por decisión del dueño + mantenibilidad.

---

## DV-SP-5 — Asignación real reusa `candidacy.assignedAgentId` + validación de membresía

**Decisión**: reusar la columna existente `candidacy.assignedAgentId` (FK `user.id`). El selector lista los
**miembros de la org activa** (consulta a `member` por `organization_id`, como hace `resolveAgentId` en
`showings/service.ts`). Asignar valida que el `userId` destino sea `member` de la org → si no, **rechaza**
(FR-024). `NULL` = "Sin asignar" (FR-025). Cualquier miembro (owner+agent) puede reasignar (`requireMember`).

**Rationale**: la columna y el patrón de consulta de miembros ya existen; solo falta exponer la mutación y
el selector. La validación de membresía es el control de seguridad clave (no asignar a un usuario ajeno a la
org).

**Alternativas consideradas**:
- *Asignar también la `conversation.assignedAgentId` en el mismo paso*: acoplaría pipeline y bandeja. Se
  deja **fuera de alcance** (la asignación del trato y la de la conversación son ortogonales por ahora); se
  puede sincronizar en una feature futura si el dueño lo pide.

---

## DV-SP-6 — Origen de los tratos: **auto-alta por inbound** (decisión del dueño) + alta manual

**Decisión** (reemplaza la versión previa de este DV tras feedback del dueño): el **primer mensaje inbound**
de un contacto **auto-crea** un trato **sin propiedad** en la **etapa inicial** (la de menor `sort_order`,
normalmente "Nuevo"), extendiendo el auto-alta de contacto que ya hace `src/server/inbox/ingest.ts` (009).
Así **todo contacto entrante aparece en el pipeline**. Idempotente: a lo sumo **un trato sin-propiedad por
cliente** (unique parcial `(org, client) WHERE property_id IS NULL`, DV-SP-2). Se mantiene además el **alta
manual** `POST /api/pipeline/deals` para tratos con propiedad concreta.

**Rationale**: el dueño fue explícito — *"todos los mensajes entrantes deben aparecer en alguna etapa del
pipeline, en la inicial si son nuevos"*. Invierte mi decisión inicial (que evitaba ruido). El riesgo de
ruido (contactos basura) se mitiga con el **soft-delete** (FR-005): archivar el contacto saca su tarjeta
del tablero. La elección de qué contacto trabajar deja de ser una barrera de entrada al pipeline.

**Interacción con la automatización de visita** (evitar tarjetas duplicadas): si el cliente solo tiene el
trato **sin-propiedad** del auto-alta y aún no hay trato para la propiedad de la visita, ese trato se
**promueve** (se le asocia la propiedad y se aplica la regla de avance, DV-SP-8) en vez de crear una segunda
tarjeta. Propiedades **adicionales** del mismo cliente sí generan tratos adicionales (modelo multi-trato,
DV-SP-2).

**Alternativas consideradas**:
- *Solo alta manual (no auto-crear por inbound)*: era mi decisión previa; el dueño la revirtió. Rechazada.
- *Auto-crear con la propiedad "adivinada" del primer match*: acoplaría el pipeline al matching y metería
  ruido de propiedad equivocada. Rechazada: el trato nace sin propiedad y se concreta luego.

---

## DV-SP-7 — Refresco entre miembros y concurrencia: polling + "gana el último"

**Decisión**: el tablero refresca por **polling** reusando la abstracción `lib/realtime` (DV-1 de 001,
websocket-ready), no realtime instantáneo. La concurrencia (dos agentes mueven la misma tarjeta) se resuelve
**"gana el último"**: cada PATCH escribe el `stage_id`/`assignedAgentId` y ambos tableros convergen al
siguiente refresco. Mover a una etapa que otro miembro **eliminó** entre tanto → el PATCH valida que la
etapa exista en la org y, si no, **rechaza** y el tablero refresca al estado real (Edge case).

**Rationale**: agencia chica (2–10 usuarios), baja contención; "gana el último" es suficiente y evita la
complejidad de locking/versionado. Consistente con la decisión DV-1 del proyecto (polling tras una
abstracción).

**Alternativas consideradas**:
- *Optimistic locking con `version`*: innecesario para esta escala; se puede añadir si aparece contención
  real. Rechazada por YAGNI.
- *WebSocket en vivo*: la abstracción ya permite cambiar a esto sin reescribir; fuera de alcance ahora.

---

## DV-SP-8 — Regla de avance de las automatizaciones (resuelve F1 del analyze) + puente a la feature 011

**Decisión** (elegida por el dueño: "avanzar, nunca retroceder solo"): toda **automatización** que cambie
la etapa de un trato mueve **solo hacia adelante** en el orden de etapas y **nunca retrocede** sola; el
retroceso queda para la acción **manual** del usuario. Se implementa un helper
`advanceStageForward(orgId, dealId, targetStageId)` que solo aplica el cambio si
`target.sort_order > actual.sort_order` (si no, no-op).

**Aplicación inmediata en 010** — `showings/service.ts` `ensureCandidacy`:
- Hoy usa `onConflictDoNothing` (solo fija la etapa al **crear**). Pasa a: resolver el ancla `visit` de la
  org y, si el trato ya existía, **avanzar** a `visit` **solo si estaba antes** (regla de avance); si ya
  estaba igual o más adelante, no cambia (FR-030). Esto **resuelve la inconsistencia F1** del análisis
  (el spec pedía "se marca sola" pero `onConflictDoNothing` no movía tratos existentes).
- Promoción del trato sin-propiedad (DV-SP-6): si el cliente solo tenía el trato de auto-alta sin propiedad,
  se le asocia la propiedad de la visita en vez de duplicar.

**Puente a la feature 011 (clasificador agéntico)**: el dueño quiere que la IA mueva los tratos por el
embudo con un **prompt de clasificación configurable por agencia** y un **modelo barato**. Se difiere a
011, que **reutilizará**: (a) este `advanceStageForward` (la IA también avanza, no retrocede; el retroceso
sigue siendo manual); (b) las **etapas configurables** por org de 010 (el clasificador recibe las etapas
reales de la agencia y elige entre ellas); (c) la infra de IA de 004 con
**`google/gemini-2.5-flash-lite`** (barato, ya probado en matching; `v4-pro` no sirvió — memoria del
proyecto). Guardarraíl previsto para 011: la IA **no** auto-cierra a `won`/`lost` sin control humano.
010 **no** implementa nada de esto; solo deja la regla de avance y las etapas configurables listas.

**Alternativas consideradas** (para el movimiento de automatizaciones):
- *Mover libre (adelante y atrás)*: más agéntico pero deshace avance del equipo sin intervención. Rechazada
  por el dueño.
- *IA sugiere y el humano confirma*: máxima seguridad pero más fricción y menos agéntico. Rechazada como
  default (podría ser un modo opcional en 011).

---

## Reusos obligatorios (no reinventar)

- **`requireMember()` / `requireOwner()`** (`src/lib/auth/guards.ts`) — autorización + scope de tenant.
- **`getOrCreateConversation()`** (`src/server/inbox/conversations.ts`, 009) — para "Abrir en bandeja".
- **Soft-delete** de `client` (009, `archivedAt`) y `property` (007, `archivedAt`) — el tablero **omite**
  tratos con cliente/propiedad archivado.
- **`lib/realtime`** (polling) — refresco del tablero.
- **`lib/design/status.ts`** (`STAGE_LABEL`/`STAGE_VAR`/colores) — **semilla visual** de las etapas por
  defecto al sembrar `pipeline_stage`.
- **Consulta de `member` por org** (patrón de `resolveAgentId`) — selector de agente + validación de
  membresía.
- **URL prefirmada R2** `getDownloadUrl` (007) — foto principal en el panel.
