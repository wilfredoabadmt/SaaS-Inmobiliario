# Contract — API interna (por historia)

Convenciones en [README.md](./README.md). Todo endpoint requiere sesión y opera en la
organización activa. `O` = solo `owner`; `A` = `owner` y `agent`.

---

## Salud / operación

### GET `/api/health` — `público`
Verifica conexión a DB (`SELECT 1`). → `200 {"status":"ok"}` · `503` si la DB no
responde. Usado por el healthcheck de Coolify.

---

## P1 — Comunicación

### Conexión de WhatsApp (Embedded Signup) — `O`
- **POST `/api/whatsapp/connect`** — body `{ code, wabaId?, phoneNumberId? }` del
  Embedded Signup. Intercambia el código server-side, cifra el token (AES-256-GCM) y
  crea/actualiza `meta_credentials`. → `200 { status: "connected", displayPhoneNumber }`.
  Nunca devuelve el token. (FR-001/FR-006)
- **GET `/api/whatsapp/connection`** — estado de la conexión. →
  `200 { status: connected|disconnected|expired, displayPhoneNumber }`.

### Bandeja (inbox) — `A`
- **GET `/api/conversations`** — `?cursor&limit&q&assignedTo&propertyId`. Lista
  ordenada por `last_message_at desc`. Cada item incluye: cliente, último mensaje,
  `primaryProperty` (de `conversation_property where is_primary`). (FR-002)
- **GET `/api/conversations/:id/messages`** — `?cursor&limit`. Mensajes del hilo
  (inbound/outbound) en orden cronológico. (FR-003)
- **POST `/api/conversations/:id/messages`** — body `{ body: string }`. Envía mensaje
  de texto vía Cloud API; persiste outbound (`status: sent`). (FR-003)
- **POST `/api/conversations/:id/messages/template`** — body
  `{ templateId, variables?: Record<string,string> }`. Envía plantilla aprobada.
  (FR-004)

> **Tiempo real (DV-1)**: el frontend consume los mensajes nuevos a través de una
> **única abstracción de transporte** (p. ej. hook `useRealtimeMessages`). En el MVP
> esa abstracción hace **polling** del endpoint `GET …/messages`; migrar a websocket
> en v1.1 solo cambia la implementación interna de la abstracción, no este contrato
> ni los componentes consumidores.

### Plantillas — `A` (gestión `O`)
- **GET `/api/templates`** — lista de plantillas aprobadas de la agencia.
- **POST `/api/templates`** `O` — registra metadata de una plantilla aprobada en Meta.

---

## P2 — Dominio inmobiliario

### Propiedades — `A`
- **GET `/api/properties`** — `?cursor&limit&operationType&status&q`. Catálogo. (FR-010)
- **POST `/api/properties`** — body = campos de `property` (operación, tipo, precio+
  moneda, ubicación, recámaras, baños, m², estacionamientos, estado, descripción).
  Valida con Zod. (FR-010/FR-011/FR-012)
- **GET `/api/properties/:id`** — detalle + fotos.
- **PATCH `/api/properties/:id`** — edición parcial.
- **DELETE `/api/properties/:id`** — bloquea o advierte si tiene candidaturas/
  conversaciones/muestras asociadas (edge case del spec).

### Fotos de propiedad — `A` (FR-013)
- **POST `/api/properties/:id/photos/presign`** — body `{ contentType, sizeBytes }`.
  Valida tipo ∈ {jpeg,png,webp}, `sizeBytes ≤ 10MB`, y que la propiedad tenga < 20
  fotos. → `200 { uploadUrl, storageKey }` (URL S3 prefirmada).
- **POST `/api/properties/:id/photos`** — confirma `{ storageKey, contentType,
  sizeBytes, sortOrder? }` tras subir a S3.
- **DELETE `/api/properties/:id/photos/:photoId`**.

### Vínculo conversación ↔ propiedad — `A` (FR-014)
- **POST `/api/conversations/:id/properties`** — body `{ propertyId, isPrimary? }`.
  Asocia (M:N). Si `isPrimary`, desmarca la principal anterior (índice único parcial).
- **DELETE `/api/conversations/:id/properties/:propertyId`** — desvincula.

### Clientes y candidaturas — `A` (FR-015)
- **GET `/api/clients`** / **GET `/api/clients/:id`** — contactos de la agencia.
- **POST `/api/candidacies`** — body `{ clientId, propertyId, assignedAgentId? }`.
  Crea la candidatura (par único cliente-propiedad), `stage = nuevo`.
- **GET `/api/candidacies`** — `?propertyId&clientId&stage&cursor&limit` (vista
  pipeline).
- **PATCH `/api/candidacies/:id`** — `{ stage?, assignedAgentId? }`. Cambia etapa del
  pipeline (registra el cambio). El estado `documentacion` es **manual** (DV-5): lo
  fija el agente al solicitar documentos; no se activa solo al subir archivos.

---

## P3 — Operación comercial

### Equipo — `O` (FR-009)
- **POST `/api/team/invitations`** — body `{ email, role: "agent" }`. Crea invitación
  (Better Auth org plugin).
- **GET `/api/team/members`** — miembros y roles.
- **DELETE `/api/team/members/:userId`** — remueve (maneja reasignación, edge case).

### Muestras / visitas — `A` (FR-016/FR-017)
- **POST `/api/showings`** — body `{ propertyId, candidacyId?, agentId, scheduledAt,
  remindAt? }`. Crea la muestra (`status: agendada`); si falta `remindAt`, se calcula
  por defecto (24 h y 1 h antes).
- **GET `/api/showings`** — `?from&to&agentId&propertyId&status`. Agenda.
- **PATCH `/api/showings/:id`** — `{ status?, scheduledAt?, notes? }`
  (realizada/cancelada/no_show).

> Recordatorio (FR-017/SC-006, DV-2): un proceso programado (cron) emite el
> recordatorio cuando `now() ≥ remind_at` y `status = agendada`. **Canal: WhatsApp con
> plantilla aprobada**, dirigido al agente responsable de la muestra.

---

## P4 — Documentos y contratos (sin generación)

### Expediente del candidato — `A` (FR-019)
- **POST `/api/clients/:id/documents/presign`** — `{ contentType, sizeBytes,
  documentType }`. Valida MIME/tamaño. → `{ uploadUrl, storageKey }`.
- **POST `/api/clients/:id/documents`** — confirma `{ storageKey, documentType,
  fileName, contentType, sizeBytes }`.
- **GET `/api/clients/:id/documents`** — lista; descarga vía URL prefirmada temporal.

### Contratos — `A` (FR-020/FR-021/FR-022)
- **POST `/api/candidacies/:id/contracts/presign`** — `{ contentType, sizeBytes }`.
  → `{ uploadUrl, storageKey }`.
- **POST `/api/candidacies/:id/contracts`** — confirma `{ storageKey, operationType,
  fileName, contentType, sizeBytes }`; `status = borrador`.
- **PATCH `/api/contracts/:id`** — `{ status }` ∈
  {borrador, enviado, en_negociacion, firmado}. Solo rastrea estado.
- **GET `/api/candidacies/:id/contracts`** — lista + estado actual.

> **FR-022**: no existe ningún endpoint de *generación* de contratos/documentos. El
> sistema únicamente sube (presign + confirm) y rastrea estado. Cualquier intento de
> generar queda fuera de alcance v1.
