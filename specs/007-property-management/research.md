# Research — Administración de propiedades (007)

Decisiones técnicas (DV) que resuelven las ambigüedades del plan. Las 3 decisiones de **producto**
ya se cerraron con el dueño antes de la spec (fotos en alcance · archivar no borrar · match inverso +
requisitos manuales) y no se re-litigan aquí.

## DV-1 — Soft-delete: ¿columna `archived_at` vs nuevo valor de enum `status`?

**Decisión**: Añadir columna **`property.archived_at timestamp NULL`** (aditiva). Archivado y estatus
son **ortogonales**: una propiedad archivada conserva su último estatus (disponible/apartada/cerrada).

**Rationale**:
- Meter "archivada" en el enum `property_status` obligaría a migrar el enum (no aditivo limpio) y
  perdería el estatus previo al archivar/desarchivar (US2 AS3 exige volver "con su estatus previo").
- `archived_at IS NULL` = activa; `NOT NULL` = archivada, y de paso registra **cuándo**.
- El filtro por defecto del inventario y del matching es `archived_at IS NULL` — una sola condición.

**Alternativas**: (a) enum nuevo `archivada` — rechazada (pierde estatus + migración de enum);
(b) `boolean is_archived` — rechazada (no guarda la fecha; `timestamp NULL` es estándar de soft-delete).

**Índice**: añadir `property_org_archived_idx (organization_id, archived_at)` para que el listado
activo no escanee toda la tabla.

## DV-2 — Subida de fotos: ¿proxy por el server vs PUT directo prefirmado?

**Decisión**: **PUT directo cliente→R2** con URL prefirmada (`getUploadUrl`), patrón en dos pasos:
1. `POST /api/properties/[id]/photos` con `{ contentType, sizeBytes }` → el server valida, genera
   `storageKey = properties/{propertyId}/{newId("propertyPhoto")}.{ext}` y devuelve `{ uploadUrl, photoId, storageKey }`.
2. El cliente hace `PUT uploadUrl` con los bytes; al éxito llama de nuevo (confirmación) para **crear
   la fila `property_photo`** con el `sizeBytes`/`contentType` reales.

**Rationale**:
- Principio I/II: el server nunca recibe los bytes ni expone credenciales S3; solo firma. R2 portable.
- `getUploadUrl` ya existe en `src/lib/storage`. El seed dev sube por `putObject` (server) pero es
  dev-only; la vía de usuario debe ser prefirmada para no cargar el VPS.
- La fila se crea en la **confirmación** para no dejar registros sin objeto (evita fotos rotas).

**Validación** (en el paso 1, server-side, Zod): `contentType ∈ {image/jpeg,image/png}`,
`sizeBytes ≤ 10 MB` y `> 1000 bytes` (alineado con el guardrail del seed). Tipo no permitido → 422.
**WebP queda excluido** (F1): los mensajes de imagen de Meta soportan de forma fiable jpeg/png; una
foto principal webp rompería la tarjeta de 006.

**CORS de R2 (U1, requisito de runtime)**: el `PUT` directo navegador→R2 exige que el bucket tenga una
política CORS que permita `PUT`/`GET` desde el origen de la app (`http://localhost:3000` en local y el
dominio del deploy). Sin ella, R2 rechaza la subida con error CORS aunque la URL prefirmada sea válida.
Se configura en el dashboard de Cloudflare R2 (no desde código). Política mínima documentada en
`quickstart.md §1.5`.

**Idempotencia / huérfanos**: si el cliente sube a R2 pero no confirma, queda un objeto huérfano sin
fila → invisible en la UI (la galería se arma desde `property_photo`). Aceptable en MVP; un barrido
opcional de huérfanos queda fuera de alcance (documentado en spec Edge Cases).

## DV-3 — Foto principal: ¿campo `is_main` vs convención `sortOrder=0`?

**Decisión**: Mantener la **convención existente `sortOrder` ascendente; principal = menor sortOrder**
(lo que ya consume `resolveMainPhotoUrls` y la ficha de 006). "Marcar principal" = mover esa foto a
`sortOrder=0` y reindexar el resto.

**Rationale**: cero cambios de esquema; `resolveMainPhotoUrls`/ficha 006 ya dependen de esa
convención. Añadir `is_main` duplicaría la fuente de verdad y arriesgaría inconsistencia.

**Reordenar**: el endpoint `PATCH photos/[photoId]` acepta `{ sortOrder }` o acción `make_main`; el
servicio **renumera** las fotos de la propiedad (0..n) en una transacción para que siempre haya a lo
más una principal. Al **eliminar** la principal, la renumeración deja a la siguiente en `0`.

## DV-4 — Match inverso: ¿nueva lógica vs reuso del scoring de 004?

**Decisión**: **Reusar** `scoreProperty(property, requirements)` de `engine.ts` invirtiendo la
entrada: dado un `propertyId`, cargar los `client_requirements` del tenant y puntuar **esa** propiedad
contra cada uno. Extraer `scoreProperty` (hoy interno) a export y añadir
`matchClientsForProperty(orgId, propertyId, { topN })`.

**Rationale**:
- Mismo criterio de match en ambas direcciones (consistencia para el usuario): presupuesto ±15%,
  zona, tipo, recámaras≥, baños≥.
- El gate por operación se invierte: solo requisitos cuya `operation` sea null o == `property.operationType`.
- Excluir propiedades **archivadas** del match inverso (gate `archived_at IS NULL`) — y el matching
  directo de 004 también debe excluir archivadas (cambio menor en su `where`).

**Orden y vacío**: ordenar por `pct` desc, descartar `pct=0`, `topN` por defecto 20 (lista de clientes
de una agencia chica). Sin requisitos compatibles → `[]` → la UI muestra estado vacío (no error).

**IA (rerank)**: el rerank opcional de 004 es propiedad→propiedades; **no** se reusa en el inverso en
v1 (el inverso es determinista). Se documenta como posible mejora futura. Evita además el costo/latencia
de IA en una vista de inventario.

## DV-5 — Edición manual de requisitos: ¿nuevo servicio vs reuso de `upsertRequirements`?

**Decisión**: **Reusar** `upsertRequirements(orgId, clientId, patch, "manual")` tal cual. El endpoint
`PUT /api/clients/[id]/requirements` valida el patch con Zod y delega. `source="manual"` y el bump de
`version` (que invalida la caché de matches) ya están implementados.

**Rationale**: el servicio ya hace merge por campo, sube `version` e invalida caché. Cambiar `source`
a "manual" es exactamente el caso de uso del asesor. Cero duplicación.

**Validación cruzada**: `budgetMin ≤ budgetMax` cuando ambos vienen (regla nueva en el Zod del
endpoint; el servicio no la impone). `operation`/`propertyType` contra los enums existentes.

## DV-6 — Acceso a `/properties`: ¿query en Server Component vs endpoint GET?

**Decisión**: El **listado** se resuelve en el Server Component (`page.tsx`) llamando a
`listProperties(orgId, filters)` directamente (con `requireMember()`), igual que el resto del
dashboard. El **detalle**, fotos y match inverso, al ser interactivos desde un panel cliente, usan
**endpoints** (`GET /api/properties/[id]`, `.../matching-clients`). Crear/editar/estatus/archivar/fotos
son **mutaciones** → endpoints.

**Rationale**: SSR para la primera carga (rápido, sin flash), endpoints para la interacción del panel
(sheet) sin recargar. Coherente con el patrón actual del repo (la bandeja usa endpoints; el dashboard
usa Server Components para el primer render).

## DV-7 — Rol: ¿quién puede administrar el inventario?

**Decisión**: `requireMember()` (owner **y** agent) para todo el CRUD de propiedades/fotos/requisitos.
El inventario es trabajo diario del asesor (agent), no una acción de cuenta. (`requireOwner` se reserva
para conexión de WhatsApp / equipo.)

**Rationale**: la constitución pide rol por tenant; administrar propiedades es la función del agent.
Coincide con cómo la spec describe al actor ("el asesor").

## Resumen de cambios de esquema

Solo **uno, aditivo**: `property.archived_at timestamp NULL` + índice
`property_org_archived_idx (organization_id, archived_at)`. Sin cambios en `property_photo` ni
`client_requirements`. Migración Drizzle generada y aplicada por Pre-Deployment Command (gotcha
conocido: el comando de migración debe estar configurado en Coolify o no corre).
