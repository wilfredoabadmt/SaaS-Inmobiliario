# Contracts — 009 Gestión de contactos vinculada a la bandeja

Endpoints nuevos bajo `/api/clients`. **Todos**: autenticados, scope por `organization_id` vía
`requireMember()` (owner+agent), input validado con Zod (`src/lib/clients/schemas.ts`), errores en JSON.
Convención de errores del proyecto: `400` input inválido (Zod), `401` no autenticado, `404` recurso
inexistente o de otra org (no se filtra existencia entre tenants), `409` conflicto de unicidad.

Tipos compartidos en `src/lib/clients/types.ts` (`Channel`, `ClientListItem`).

---

## `POST /api/clients` — Crear contacto (FR-002)

**Body** (Zod `createClientSchema`):

```jsonc
{
  "name": "Ana López",        // opcional, string ≤120
  "phone": "5215512345678",   // requerido, string E.164-ish, normalizado server-side
  "email": "ana@x.com",       // opcional, email
  "notes": "Renta zona norte" // opcional, string ≤2000
}
```

**Comportamiento**: inserta con `channel='manual'`. Unicidad `(org, phone)`.

**Respuestas**:
- `201` → `{ "id": "client_…", "channel": "manual" }`
- `400` → `{ "error": "validation", "issues": [...] }`
- `409` → `{ "error": "phone_taken", "message": "Ya existe un contacto con ese teléfono." }`

---

## `GET /api/clients` — Listar contactos (FR-001) *(opcional)*

> La lista la puede resolver directamente la página server (`clients/page.tsx` → `listClients`). Este
> endpoint se incluye para refresco client-side / búsqueda incremental si se necesita.

**Query**: `?q=<texto>` (opcional, filtra por nombre/teléfono).

**Respuestas**:
- `200` → `{ "clients": ClientListItem[] }` (orden: última actividad desc, luego creación desc)

---

## `GET /api/clients/[id]` — Detalle (FR-005)

**Respuestas**:
- `200` → `{ id, name, phone, email, notes, channel, conversationId, lastActivityAt }`
- `404` → contacto inexistente o de otra org.

---

## `PATCH /api/clients/[id]` — Editar (FR-003 / FR-004 / DV-CM-7)

**Body** (Zod `updateClientSchema`, todos opcionales; al menos uno):

```jsonc
{ "name": "…", "phone": "…", "email": "…", "notes": "…" }
```

**Comportamiento**: actualiza solo los campos provistos. `channel` **no** es aceptado (ignorado/derivado).
Si se cambia `phone` y choca con otro contacto de la org → `409`.

**Respuestas**:
- `200` → `{ "id": "client_…" }`
- `400` → validación
- `404` → inexistente/otra org
- `409` → `{ "error": "phone_taken", "message": "Ya existe un contacto con ese teléfono." }`

---

## `POST /api/clients/[id]/conversation` — Get-or-create conversación (US4 / DV-CM-2/3/5)

Resuelve la conversación del contacto para el atajo "Enviar mensaje". **No envía nada** ni aplica reglas
de ventana/plantilla (eso es de la bandeja). Usa el helper compartido `getOrCreateConversation`.

**Body**: vacío.

**Respuestas**:
- `200` → `{ "conversationId": "conversation_…" }` (existente o recién creada shell)
- `404` → contacto inexistente/otra org.

**Uso en UI**: el botón "Enviar mensaje" llama este endpoint y luego `router.push("/inbox?c=<id>")`.

---

## Contrato de UI: deep-link de la bandeja (DV-CM-3)

- `GET /inbox?c=<conversationId>`: la página server lee `searchParams.c`, valida que la conversación sea
  de la org (vía la lista ya scoped), y pasa `initialConversationId` a `InboxClient`, que la
  **preselecciona**. Si el `c` no pertenece a la org / no existe en la lista → se ignora (abre la bandeja
  normal, sin selección), nunca filtra datos de otra org.
- A partir de ahí, **la bandeja** aplica sus reglas: ventana 24h abierta → texto libre; cerrada → exige
  plantilla aprobada. 009 no añade lógica de envío.

---

## Reglas transversales (constitución)

- **Tenant**: cada handler obtiene `organizationId` de `requireMember()` y lo incluye en **todo** `where`.
  Ningún `id` de otra org es legible/editable (devuelve 404).
- **Idempotencia**: el get-or-create de conversación y el upsert de contacto son idempotentes; no hay
  webhook nuevo en esta feature.
- **Roles**: owner y agent pueden crear/editar/listar (FR-015). No hay operación exclusiva de owner aquí.
- **Sin secretos**: ninguna respuesta incluye tokens/credenciales de canal.
