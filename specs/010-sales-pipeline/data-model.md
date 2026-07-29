# Data Model: 010-sales-pipeline

Cambios al esquema (`src/lib/db/schema/domain.ts`) + migración con backfill. Todo scoped por
`organization_id` (Principio III). Aditivo donde se puede; la única mutación destructiva es reemplazar la
columna `candidacy.stage` (enum) por `candidacy.stage_id` (FK), con backfill que **preserva** la etapa de
cada trato vivo (ver research DV-SP-1).

---

## 1. Tabla nueva: `pipeline_stage`

El conjunto **ordenado y por-organización** de etapas del embudo (reemplaza el `pgEnum candidacyStage`
global como fuente de las columnas del tablero).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `text` PK | `newId("pipeline_stage")` (prefijo nanoid). |
| `organization_id` | `text` NOT NULL FK→`organization` (cascade) | Tenant. Indexado. |
| `label` | `text` NOT NULL | Etiqueta visible; el owner la renombra. |
| `sort_order` | `integer` NOT NULL | Orden de columnas (0 = primera). |
| `kind` | `text` NOT NULL default `'normal'` | Rol semántico: `normal` \| `won` \| `lost` \| `visit`. Las anclas (`won`/`lost`/`visit`) **no se eliminan**; `label` editable, `kind` inmutable. |
| `color` | `text` (nullable) | Token de color para el punto/cabecera (semilla desde `STAGE_VAR` de `lib/design/status.ts`); custom → neutro. |
| `created_at` | `timestamp` NOT NULL default now | |
| `updated_at` | `timestamp` NOT NULL default now | |

**Índices**:
- `pipeline_stage_org_order_idx` en `(organization_id, sort_order)` — lectura ordenada del tablero.
- `pipeline_stage_org_kind_anchor_uq`: **unique parcial** en `(organization_id, kind)` `WHERE kind <> 'normal'`
  — exactamente **un** `won`, un `lost` y un `visit` por organización (las anclas son únicas; las `normal`
  pueden ser muchas).

**Reglas**:
- `is_deletable` es **derivado** (no se almacena): `kind = 'normal'`. Eliminar una etapa con `kind <> 'normal'`
  se rechaza (FR-010).
- No se puede eliminar una etapa que tenga tratos sin reubicarlos (FR-012) → garantizado por el FK
  `RESTRICT` de `candidacy.stage_id` **y** validado en app con mensaje claro (opcional `reassignToStageId`).

**Semilla por defecto** (`seedDefaultStages(orgId)`), idempotente, desde `lib/design/status.ts`:

| sort_order | label | kind |
|---|---|---|
| 0 | Nuevo | normal |
| 1 | Contactado | normal |
| 2 | Calificado | normal |
| 3 | Visita agendada | **visit** |
| 4 | Documentación | normal |
| 5 | En negociación | normal |
| 6 | Ganado | **won** |
| 7 | Perdido | **lost** |

---

## 2. Tabla modificada: `candidacy` (el "trato")

Cambios:

1. **`stage` (enum) → `stage_id` (FK)**:
   - Eliminar `stage candidacyStage("stage")`.
   - Añadir `stage_id text NOT NULL REFERENCES pipeline_stage(id) ON DELETE RESTRICT`.
   - `RESTRICT` implementa "no borrar una etapa con tratos" a nivel BD (FR-012).
2. **`property_id` → nullable** (DV-SP-2):
   - `property_id text` (quita `NOT NULL`).
   - `ON DELETE` de `cascade` → **`set null`** (el trato sobrevive si la propiedad se borra; con 007 se
     archivan, no se borran).
3. **Unicidad** (sustituye el unique actual `(org, client, property)`):
   - `candidacy_org_client_property_uq`: unique `(organization_id, client_id, property_id)` — un trato por
     cliente×propiedad concreta (se mantiene; con `property_id` NULL no aplica por el parcial de abajo).
   - `candidacy_org_client_noprop_uq`: **unique parcial** `(organization_id, client_id)`
     `WHERE property_id IS NULL` — a lo sumo un trato "sin propiedad" por cliente (DV-SP-2).

| Columna | Antes | Después |
|---|---|---|
| `stage` | `candidacy_stage` enum NOT NULL default `'nuevo'` | **eliminada** |
| `stage_id` | — | `text` NOT NULL FK→`pipeline_stage` ON DELETE RESTRICT |
| `property_id` | `text` NOT NULL FK ON DELETE cascade | `text` **nullable** FK ON DELETE **set null** |
| `assigned_agent_id` | `text` FK→`user` (sin cambio) | igual (reuso DV-SP-5) |
| `client_id`, `organization_id`, timestamps | (sin cambio) | igual |

**Índice nuevo**: `candidacy_org_stage_idx` pasa de `(organization_id, stage)` a
`(organization_id, stage_id)` (lectura del tablero agrupada por etapa).

---

## 3. Migración (orden exacto — seed-then-map, no destructiva para datos)

```text
1. CREATE TABLE pipeline_stage (...);  + índices (incl. unique parcial de anclas).
2. SEED por cada organization existente las 8 etapas por defecto (labels/kind/sort_order/color).
   (idempotente: solo si la org no tiene etapas.)
3. ALTER TABLE candidacy ADD COLUMN stage_id text;            -- nullable temporal
4. UPDATE candidacy c
     SET stage_id = ps.id
     FROM pipeline_stage ps
     WHERE ps.organization_id = c.organization_id
       AND ps.label = <label-por-defecto del valor de c.stage>;  -- map enum→fila sembrada (por label, válido pre-rename)
   -- mapa: nuevo→'Nuevo', contactado→'Contactado', calificado→'Calificado',
   --       visita_agendada→'Visita agendada', documentacion→'Documentación',
   --       en_negociacion→'En negociación', ganado→'Ganado', perdido→'Perdido'
5. ALTER TABLE candidacy ALTER COLUMN stage_id SET NOT NULL;
   ALTER TABLE candidacy ADD CONSTRAINT ... FOREIGN KEY (stage_id) REFERENCES pipeline_stage(id) ON DELETE RESTRICT;
6. ALTER TABLE candidacy DROP COLUMN stage;                   -- el enum sale de candidacy
7. ALTER TABLE candidacy ALTER COLUMN property_id DROP NOT NULL;  -- nullable
   -- recrear FK property_id con ON DELETE SET NULL
8. DROP INDEX candidacy_org_client_property_uq?  -> recrear igual + AÑADIR unique parcial noprop.
   -- (el unique (org,client,property) se conserva; se añade el parcial WHERE property_id IS NULL)
9. (opcional, limpieza posterior) DROP TYPE candidacy_stage;  -- si ningún otro objeto lo usa
```

**Notas de la migración**:
- El proyecto aplica migraciones por **Pre-Deployment Command** (o exponiendo Postgres temporalmente). Esta
  migración **toca datos vivos** → probar primero en `inmox-dev` y verificar conteos antes/después
  (`SELECT stage, count(*)` viejo vs. `SELECT ps.label, count(*)` nuevo deben coincidir).
- `showings/service.ts` debe desplegarse **junto** con la migración: `ensureCandidacy` ya no puede usar
  `stage:"visita_agendada"`; pasa a `stage_id = resolveAnchorStage(org,'visit')`. Si se despliega el código
  viejo contra el esquema nuevo, fallaría al insertar (no existe `stage`). → migración + código en el mismo
  deploy.
- Organizaciones creadas **después** de la migración: `seedDefaultStages(orgId)` se llama de forma
  idempotente al primer acceso al tablero o al crear el primer trato (no hay etapas sembradas en el alta de
  org todavía; alternativamente, sembrar en el flujo de creación de organización — decisión de tasks).

---

## 4. Entidades reusadas (sin cambio de esquema)

- **`client`** (009): `name`, `phone`, `channel` (badge), `archivedAt` (omitir archivados). Panel de detalle.
- **`client_requirements`** (004): requisitos del cliente en el panel.
- **`property`** (007): propiedad del trato; `archivedAt` (omitir); foto principal vía `property_photo` +
  URL prefirmada.
- **`conversation`** (+ `message`): resumen de últimos mensajes + `getOrCreateConversation` para el deep-link.
  Además, el **ingest** (`src/server/inbox/ingest.ts`) es el punto del auto-alta de trato por inbound (§6).
- **`member`** (auth): miembros de la org para el selector y la validación de asignación.
- **`showing`** (003/004): su `ensureCandidacy` pasa de `onConflictDoNothing` a **avanzar-solo** hacia el
  ancla `visit` (DV-SP-8) y a **promover** el trato sin-propiedad si aplica (DV-SP-6).

---

## 5. IDs

Añadir prefijo en `src/lib/db/ids.ts`: `pipeline_stage` → p. ej. `pst_…`. `candidacy` ya existe.

---

## 6. Auto-alta por inbound y regla de avance (DV-SP-6 / DV-SP-8)

**Etapa inicial** = la fila de `pipeline_stage` de la org con menor `sort_order` (normalmente "Nuevo");
**ancla de visita** = la fila con `kind = 'visit'`. Helpers en `src/server/pipeline/stages.ts`:
`resolveInitialStage(orgId)` y `resolveAnchorStage(orgId, kind)`.

**Auto-alta por inbound (`ingest.ts`)**: al dar de alta/enriquecer el contacto (009), si el cliente **no
tiene** ningún trato, se inserta un `candidacy` con `property_id = NULL` y `stage_id = resolveInitialStage`.
Idempotente por el unique parcial `(org, client) WHERE property_id IS NULL`
(`onConflictDoNothing`) → un inbound repetido no duplica la tarjeta.

**Regla de avance (`advanceStageForward`)**: helper que cambia `stage_id` **solo si** el `sort_order` de la
etapa destino es **mayor** que el de la actual (si no, no-op). Lo usan la automatización de visita (hoy) y
el clasificador IA (feature 011). El **PATCH manual** del usuario (mover/arrastrar) **no** está sujeto a
esta regla: el humano puede mover en cualquier dirección.

**`ensureCandidacy` (showings) revisado**:
1. Buscar trato del cliente para esa propiedad. Si existe → `advanceStageForward(... visit)`.
2. Si no existe pero el cliente tiene un trato **sin-propiedad** (auto-alta) → **promover**: `UPDATE` ese
   trato con `property_id = <propiedad>` y `advanceStageForward(... visit)` (evita tarjeta duplicada).
3. Si no hay ninguno → `INSERT` trato con esa propiedad y `stage_id = ancla visit`.
