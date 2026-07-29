# Research — 009 Gestión de contactos vinculada a la bandeja

Decisiones técnicas (DV-CM-n) tomadas para resolver el plan. Formato: Decisión · Razón · Alternativas
rechazadas. Trazabilidad (constitución VII): las decisiones bajo supuesto se registran aquí.

## DV-CM-1 — Canal de origen como columna `text`, no `pgEnum`

- **Decisión**: añadir `client.channel` como `text("channel").notNull().default("whatsapp")`, con valores
  convencionales `whatsapp | instagram | messenger | manual`. La validación del conjunto vive en Zod/TS,
  no en un tipo enum de Postgres.
- **Razón**: extensibilidad. Hoy solo WhatsApp opera; mañana entran Instagram y Messenger. Con `text` no
  hace falta `ALTER TYPE ... ADD VALUE` por cada canal nuevo. Hay **precedente en el propio esquema**:
  `client_requirements.source` es `text` (`"ai" | "manual"`), no enum. El backfill `default 'whatsapp'`
  es **correcto** porque todos los contactos existentes se auto-crearon desde un inbound de WhatsApp (la
  página de clientes era cosmética; no existía alta manual).
- **Alternativas rechazadas**: (a) `pgEnum` "client_channel" → obliga a migración de tipo por cada canal
  futuro y endurece un dominio que aún evoluciona. (b) Tabla `channel` separada con FK → sobre-ingeniería
  para 4 valores estables sin atributos propios.
- **Nota de nombre**: se llama `channel` (no `source`) para no chocar semánticamente con
  `client_requirements.source` (`ai|manual`, que significa "quién llenó los requisitos", no "por dónde
  llegó el contacto").

## DV-CM-2 — "Enviar mensaje" delega 100% en la bandeja (decisión del dueño)

- **Decisión**: el botón "Enviar mensaje" del módulo de contactos **no aplica reglas de canal**. Resuelve
  la conversación del contacto (get-or-create) y navega a `/inbox?c=<conversationId>`. La **bandeja** —que
  ya conoce la ventana de 24h (`isServiceWindowOpen` en `src/server/inbox/send.ts`) y el envío de
  plantillas (`/api/conversations/[id]/messages/template`)— decide texto libre vs. plantilla.
- **Razón**: única fuente de verdad. El dueño lo pidió explícitamente: "que solo redirija a la bandeja y
  ella decidirá". Evita duplicar (y divergir) la lógica de ventana/plantilla. Cuando entren IG/Messenger,
  cada uno aplicará sus reglas en la bandeja, no en contactos.
- **Alternativas rechazadas**: gating de plantilla dentro del módulo de contactos (segunda implementación
  de la regla 24h, riesgo de divergencia); abrir un compositor propio en `/clients` (reinventa la bandeja).

## DV-CM-3 — Deep-link por `conversationId` vía query param `?c=` en `/inbox`

- **Decisión**: la bandeja (hoy selecciona por `useState`, sin URL) acepta `?c=<conversationId>`. La página
  server (`inbox/page.tsx`) lee `searchParams` y pasa `initialConversationId` a `InboxClient`, que lo usa
  como `selectedId` inicial.
- **Razón**: mínimo cambio, robusto. El `conversationId` ya está scoped y resuelto por el endpoint
  get-or-create, así que funciona igual para contactos **con** conversación previa y para los **sin**
  (manual): el endpoint crea la conversación shell y devuelve su id.
- **Alternativas rechazadas**: deep-link por `clientId` (`?client=`) → exige resolución extra en el cliente
  y no cubre el caso "sin conversación" sin lógica adicional en la bandeja; ruta dedicada
  `/inbox/[conversationId]` → reestructura la bandeja sin necesidad para esta feature.

## DV-CM-4 — Auto-alta enriquecedora y no destructiva

- **Decisión**: en `ingest.ts`, el upsert de contacto pasa de `onConflictDoNothing` a `onConflictDoUpdate`
  con reglas: (1) setear `channel='whatsapp'` al **insertar**; (2) al conflicto, **completar** `name` solo
  si el existente es `null`/vacío (`COALESCE`), y **subir** `channel` de `'manual'` al canal real si el
  contacto se había creado a mano. Nunca pisa `name/email/notes` que el usuario editó.
- **Razón**: cumple FR-007/FR-010 (capturar lo posible sin sobrescribir lo editado) y FR-009 (no duplicar:
  un inbound de un teléfono ya existente enriquece, no crea otro). El `channel` es derivado del sistema, no
  editado por el usuario → actualizar manual→real respeta "canal de origen = primer toque real".
- **Idempotencia**: `onConflictDoUpdate` con COALESCE/condición es idempotente — reejecutar el mismo evento
  no cambia el resultado (Principio IV). La dedup de mensajes sigue por `message.wa_message_id` UNIQUE.
- **Alternativas rechazadas**: mantener `onConflictDoNothing` (no captura canal ni enriquece); pisar
  siempre con el nombre de perfil de WhatsApp (borraría ediciones manuales del asesor).

## DV-CM-5 — Helper compartido `getOrCreateConversation`

- **Decisión**: extraer `getOrCreateConversation` (hoy privado en `ingest.ts`) a
  `src/server/inbox/conversations.ts` y consumirlo desde el ingest **y** el nuevo endpoint
  `POST /api/clients/[id]/conversation`.
- **Razón**: una sola definición de "cómo se obtiene/crea la conversación de un cliente" evita que el
  atajo de contactos y el webhook diverjan (p. ej. en defaults `aiEnabled=false`, `needsHuman=false`,
  `waContactPhone`).
- **Alternativas rechazadas**: duplicar la función en el endpoint (deuda y divergencia); exportarla
  in-place desde `ingest.ts` (acopla un módulo de webhook a un endpoint de UI).

## DV-CM-6 — Badge de canal como overlay del avatar; iconos de marca inline

- **Decisión**: componente `channel-badge.tsx` que pinta, en la esquina inferior derecha del avatar, el
  icono del canal de origen. `manual` → indicador neutro (punto/inicial, sin logo de marca). Los logos de
  marca (WhatsApp, y a futuro IG/Messenger) van como **SVG inline** propios, no desde `lucide-react`
  (lucide no incluye logos de marca de forma estable).
- **Razón**: legibilidad multicanal desde un solo componente reutilizable (la bandeja podrá reusarlo). El
  overlay encaja en el patrón de avatar existente (la bandeja ya superpone el badge de no-leídos).
- **Alternativas rechazadas**: depender de un set de iconos de marca de terceros (licencias/versionado);
  columna de texto "Canal" en la tabla (menos legible que el badge que pidió el dueño).

## DV-CM-7 — Teléfono editable con control de unicidad por organización

- **Decisión**: el teléfono es editable. La validación de unicidad se hace a nivel de servicio
  (comprobación previa) **y** se respalda en el índice único `client_org_phone_uq`; el choque devuelve
  **409 Conflict** con mensaje claro, sin crear duplicado.
- **Razón**: flexibilidad operativa (corregir un número mal capturado) sin romper la identidad de
  mensajería ni la dedup. Es la decisión por default que el dueño dejó a mi criterio.
- **Alternativas rechazadas**: teléfono de solo lectura (frustra correcciones legítimas); edición libre sin
  control (rompería el ruteo del webhook y la deduplicación).

## Contexto de reuso confirmado (no es decisión, es inventario)

- `client` (`src/lib/db/schema/domain.ts:145`): `id, organizationId, name?, phone, email?, notes?, ts`;
  UNIQUE `client_org_phone_uq (org, phone)`. **Falta** `channel`.
- Auto-alta: `getOrCreateClient` / `getOrCreateConversation` en `src/server/inbox/ingest.ts:129/155`;
  nombre de perfil desde `value.contacts[0].profile.name`.
- Ventana 24h: `isServiceWindowOpen(lastInboundAt)` en `src/server/inbox/send.ts`.
- Plantilla: `POST /api/conversations/[id]/messages/template`.
- Auth/tenant: `requireMember()` / `requireOwner()` en `src/lib/auth/guards.ts`.
- Bandeja: `inbox/page.tsx` (server) → `listConversations` (`src/server/inbox/queries.ts`) →
  `InboxClient` (selección por `useState`, sin URL).
- Clientes hoy: `clients/page.tsx` usa `SAMPLE_CLIENTS`; `clients-client.tsx` ya tiene avatar con
  iniciales (espacio para overlay).
