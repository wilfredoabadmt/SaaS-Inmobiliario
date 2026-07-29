# Contracts — Administración de propiedades (007)

Convenciones comunes a **todos** los endpoints:
- Auth: `requireMember()` (owner o agent). Sin sesión/org → `401 {error:{code:"unauthorized"}}`.
- Tenant: toda fila se busca con `organization_id` del contexto. Recurso de otro tenant → **404**
  `{error:{code:"not_found"}}` (no se distingue de "no existe", para no filtrar cross-tenant).
- Body inválido (Zod) → **422** `{error:{code:"invalid", message, issues?}}`.
- `export const dynamic = "force-dynamic"` en cada route (igual que `ficha/route.ts`).
- Éxito: `200` (lectura/mutación) o `201` (creación). Errores con forma `{error:{code,message}}`.

---

## Propiedades (CRUD + estado)

### POST `/api/properties` — crear

**Body** (Zod `propertyCreateSchema`):
```jsonc
{
  "operationType": "venta",            // requerido: renta|venta
  "propertyType": "departamento",      // requerido: casa|departamento|local|terreno
  "title": "Depto en Del Valle",       // opcional
  "price": 4200000,                    // requerido, > 0
  "currency": "MXN",                   // requerido (default "MXN")
  "address": "…", "neighborhood": "Del Valle", "city": "CDMX",  // opcionales
  "bedrooms": 2, "bathrooms": 1.5, "builtAreaM2": 78, "lotAreaM2": null,
  "parkingSpaces": 1, "description": "…",
  "status": "disponible"               // opcional, default disponible
}
```
**201** → `{ "id": "prop_…", "property": PropertyDetail }`
**422** datos inválidos (p. ej. `price ≤ 0`, enum inválido).

### GET `/api/properties/[id]` — detalle

**200** → `PropertyDetail`:
```jsonc
{
  "id": "prop_…", "operationType": "venta", "propertyType": "departamento",
  "title": "…", "price": "4200000.00", "currency": "MXN",
  "address": "…", "neighborhood": "…", "city": "…",
  "bedrooms": 2, "bathrooms": "1.5", "builtAreaM2": "78.00", "lotAreaM2": null,
  "parkingSpaces": 1, "status": "disponible", "description": "…",
  "archivedAt": null, "createdAt": "…", "updatedAt": "…",
  "photos": [ { "id": "photo_…", "url": "https://…(prefirmada)", "sortOrder": 0, "isMain": true } ]
}
```
**404** no es del tenant / no existe.

### PATCH `/api/properties/[id]` — editar (parcial)

**Body**: `propertyUpdateSchema` = `propertyCreateSchema.partial()` (cualquier subconjunto). No acepta
`archivedAt` (se cambia por su endpoint). **200** → `{ "property": PropertyDetail }`. **422** inválido.

### PATCH `/api/properties/[id]/status` — estatus rápido

**Body**: `{ "status": "apartada" }` (enum disponible|apartada|cerrada). **200** → `{ "status": "apartada" }`.

### POST `/api/properties/[id]/archive` — archivar / desarchivar

**Body**: `{ "archived": true }` (true=archivar, false=desarchivar).
- archivar → set `archived_at = now()`. desarchivar → set `archived_at = NULL`. `status` no se toca.
**200** → `{ "archived": true, "archivedAt": "2026-06-22T…" | null }`. **404** si no es del tenant.

### GET `/api/properties` *(opcional)* — listar

El listado primario lo hace `page.tsx` (Server Component) vía `listProperties`. Este GET existe para
refrescos del cliente. **Query**: `?op=todas|renta|venta&status=todos|disponible|apartada|cerrada&archived=false|true|all`.
Default `archived=false` (solo activas). **200** → `{ "properties": PropertyView[] }`.

---

## Fotos (CRUD, subida directa prefirmada)

### POST `/api/properties/[id]/photos` — firmar subida **o** confirmar

Patrón en dos pasos (DV-2), discriminado por el body:

**Paso 1 — firmar** `{ "phase": "sign", "contentType": "image/jpeg", "sizeBytes": 532104 }`
- Valida: `contentType ∈ {image/jpeg,image/png,image/webp}`, `1000 < sizeBytes ≤ 10485760`.
- **200** → `{ "photoId": "photo_…", "storageKey": "properties/prop_…/photo_….jpg", "uploadUrl": "https://…(PUT prefirmado, 900s)" }`
- **422** tipo/tamaño inválido.
- *(El cliente hace `PUT uploadUrl` con los bytes y `Content-Type` igual al firmado.)*

**Paso 2 — confirmar** `{ "phase": "confirm", "photoId": "photo_…", "storageKey": "…", "contentType": "image/jpeg", "sizeBytes": 532104 }`
- Inserta la fila `property_photo` con `sortOrder = (max actual + 1)` (al final). **201** →
  `{ "photo": { "id", "url", "sortOrder", "isMain" } }`.
- Si `storageKey` no corresponde al patrón de la propiedad del tenant → **422**.

### PATCH `/api/properties/[id]/photos/[photoId]` — reordenar / hacer principal

**Body** (uno de):
- `{ "action": "make_main" }` → mueve la foto a `sortOrder=0` y renumera el resto.
- `{ "sortOrder": 2 }` → reubica y renumera 0..n-1 (transacción).
**200** → `{ "photos": [ { id, sortOrder, isMain } … ] }` (orden resultante). **404** si la foto no es
de esa propiedad/tenant.

### DELETE `/api/properties/[id]/photos/[photoId]` — eliminar

- `deleteObject(storageKey)` + borra la fila + **renumera** las restantes (si era la principal, la
  siguiente queda en `0`). El fallo de `deleteObject` por objeto inexistente no es fatal (try/catch,
  como el seed). **200** → `{ "deleted": true, "photos": [...] }`.

---

## Match inverso (propiedad → clientes)

### GET `/api/properties/[id]/matching-clients` — clientes que matchean

- Carga `client_requirements` del tenant; puntúa **esta** propiedad contra cada uno con
  `scoreProperty` (reuso 004). Gate: requisitos con `operation` null o == `property.operationType`.
  Excluye propiedad archivada (si lo está → 200 con lista vacía y aviso). Descarta `pct=0`. `topN=20`.
- **200** →
```jsonc
{
  "propertyId": "prop_…",
  "clients": [
    { "clientId": "cli_…", "name": "Ana", "phone": "+52…",
      "pct": 80, "reasons": [ {"ok": true, "label": "Dentro de presupuesto"}, {"ok": true, "label": "Zona: Del Valle"} ] }
  ]
}
```
- Sin compatibles → `{ "propertyId": "…", "clients": [] }` (la UI muestra estado vacío, **no** error).
- **404** si la propiedad no es del tenant.

---

## Requisitos del cliente (edición manual)

### PUT `/api/clients/[id]/requirements` — upsert manual

**Body** (Zod `requirementsManualSchema`, todos opcionales; merge en el servicio):
```jsonc
{
  "operation": "venta",                // renta|venta|null
  "budgetMin": 3000000, "budgetMax": 5000000,
  "zone": "Del Valle, Narvarte",
  "propertyType": "departamento",
  "bedrooms": 2, "bathrooms": 1.5,
  "notes": "Cerca del metro"
}
```
- Validación: si `budgetMin` y `budgetMax` vienen → `budgetMin ≤ budgetMax` (si no, **422**). Enums
  válidos. Números ≥ 0.
- Delega a `upsertRequirements(orgId, clientId, patch, "manual")` (sube `version`, invalida caché).
- **200** → `{ "requirements": { …fila resultante… } }`. **404** si el cliente no es del tenant.

---

## Tabla resumen

| Método | Ruta | Acción | Éxito |
|---|---|---|---|
| POST | `/api/properties` | crear | 201 |
| GET | `/api/properties` | listar (opcional) | 200 |
| GET | `/api/properties/[id]` | detalle + fotos | 200 |
| PATCH | `/api/properties/[id]` | editar parcial | 200 |
| PATCH | `/api/properties/[id]/status` | estatus rápido | 200 |
| POST | `/api/properties/[id]/archive` | archivar/desarchivar | 200 |
| POST | `/api/properties/[id]/photos` | firmar / confirmar subida | 200/201 |
| PATCH | `/api/properties/[id]/photos/[photoId]` | reordenar/principal | 200 |
| DELETE | `/api/properties/[id]/photos/[photoId]` | eliminar foto | 200 |
| GET | `/api/properties/[id]/matching-clients` | match inverso | 200 |
| PUT | `/api/clients/[id]/requirements` | upsert manual de requisitos | 200 |
