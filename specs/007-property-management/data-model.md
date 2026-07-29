# Data Model — Administración de propiedades (007)

Reusa el esquema existente (`src/lib/db/schema/domain.ts`). **Único cambio de esquema**: columna
aditiva `property.archived_at`. Nada en `property_photo` ni `client_requirements` cambia de forma.

## Cambio de esquema (aditivo)

### `property` — añadir `archived_at`

| Campo | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `archived_at` | `timestamp` | **sí** | `NULL` | `NULL` = activa; `NOT NULL` = archivada (DV-1). Soft-delete reversible; conserva `status`. |

Drizzle (añadir dentro de `pgTable("property", {...})`):

```ts
archivedAt: timestamp("archived_at"),            // null = activa; not null = archivada
```

Índice nuevo (añadir al array de índices de `property`):

```ts
index("property_org_archived_idx").on(t.organizationId, t.archivedAt),
```

**Regla de derivación**: el inventario activo, el envío de fichas (006) y **ambos** sentidos del
matching filtran `archivedAt IS NULL`. El matching directo de 004 (`engine.computeMatches`) debe
añadir ese gate a su `where` (hoy solo filtra `status='disponible'`).

**Migración**: `pnpm drizzle-kit generate` → SQL `ALTER TABLE property ADD COLUMN archived_at timestamp;`
(aditivo, no destructivo). Aplica por Pre-Deployment Command en Coolify.

## Entidades (estado tras el cambio)

### Property

Inmueble del inventario. Campos existentes (sin cambios) + `archivedAt`.

- **PK**: `id` (`prop_…`).
- **Tenant**: `organizationId` (FK org, cascade). Toda query la incluye.
- **Dominio**: `operationType` (renta|venta), `propertyType` (casa|departamento|local|terreno),
  `title?`, `price` (numeric 14,2, **NOT NULL**), `currency` (NOT NULL), `address?`, `neighborhood?`,
  `city?`, `bedrooms?` (int), `bathrooms?` (numeric 3,1), `builtAreaM2?`, `lotAreaM2?`,
  `parkingSpaces?` (int), `description?`.
- **Estado**: `status` (disponible|apartada|cerrada, default disponible) · `archivedAt?` (nuevo).
- **Auditoría**: `createdBy?` (FK user), `createdAt`, `updatedAt`.
- **Relaciones que el archivado DEBE preservar**: `property_photo` (cascade), `conversation_property`,
  `candidacy`, `showing`, `message.propertyId`. → Archivar **no** borra la fila; el historial queda.

**Transiciones**:
- `status`: cualquier valor → cualquier valor (acción rápida US2); sin máquina rígida.
- `archivedAt`: `NULL → now()` (archivar) y `now() → NULL` (desarchivar). El `status` no se toca al
  archivar/desarchivar (vuelve "con su estatus previo", US2 AS3).

**Validación (Zod, `src/lib/properties/schemas.ts`)** — crear:
- `operationType`, `propertyType`: enum requerido.
- `price`: número > 0 (se guarda como string numeric). `currency`: string no vacío (default "MXN").
- `bedrooms`, `parkingSpaces`: int ≥ 0 opcional. `bathrooms`: número ≥ 0 opcional.
- `builtAreaM2`, `lotAreaM2`: número ≥ 0 opcional. `title`, `address`, `neighborhood`, `city`,
  `description`: string opcional.
- `status`: enum, default "disponible".
- Editar = mismo esquema en modo `.partial()` (PATCH parcial); ignora `archivedAt` (se cambia por su
  propio endpoint).

### PropertyPhoto (sin cambios de esquema)

Foto en R2. `id` (`photo_…`), `organizationId`, `propertyId` (FK property, cascade), `storageKey`,
`contentType`, `sizeBytes`, `sortOrder` (default 0), `createdAt`.

- **Principal** = menor `sortOrder` (convención DV-3; la consume `resolveMainPhotoUrls` y la ficha 006).
- **Invariante**: dentro de una propiedad, `sortOrder` es 0..n-1 sin huecos tras cada reorder/delete
  (renumeración transaccional en el servicio).
- **Validación de subida**: `contentType ∈ {image/jpeg,image/png,image/webp}`, `1000 < sizeBytes ≤ 10·1024·1024`.

### ClientRequirements (sin cambios de esquema)

Requisitos de búsqueda 1:1 por cliente. Campos existentes. Esta feature solo **escribe** vía
`upsertRequirements(..., "manual")` y **lee** para el match inverso.

- **Validación nueva del endpoint manual (Zod)**: `budgetMin ≤ budgetMax` si ambos presentes;
  `operation`/`propertyType` contra enums; números ≥ 0. Patch parcial (merge en el servicio).
- `version` sube al cambiar algo → invalida la caché de matches (incluye el match inverso si cachea).

### MatchResult (no persistido)

Resultado calculado bajo demanda. Para el **match inverso**: por cada cliente con requisitos
compatibles, `{ client: {id, name, phone}, pct: 0..100, reasons: MatchReason[] }`. Ordenado por `pct`
desc, sin los de `pct=0`, `topN=20`. Reusa `scoreProperty` (mismas dimensiones que el directo).

## Vistas / DTOs

- **PropertyView** (`src/lib/inbox/types.ts`, ya existe): se sigue usando para tarjetas/listado;
  `photoUrl?` viene de `resolveMainPhotoUrls`. Se añade en el detalle un DTO ampliado **PropertyDetail**
  con todos los campos crudos + lista de fotos (`{ id, url, sortOrder, isMain }`).
- **MatchingClient** (nuevo DTO): `{ clientId, name, phone, pct, reasons }` para el panel inverso.

## Notas de aislamiento (Principio I/III)

Todo `select`/`insert`/`update`/`delete` de esta feature lleva `eq(table.organizationId, orgId)` con
`orgId` de `requireMember()`. El `propertyId`/`clientId`/`photoId` de la URL se valida **siempre**
junto al `organizationId` (un id de otro tenant → fila no encontrada → 404). Las URLs prefirmadas se
generan solo tras confirmar que la propiedad es del tenant.
