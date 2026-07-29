# Data Model — 012-whatsapp-templates

Migración **aditiva** `drizzle/0011_whatsapp_templates.sql` (journal idx 11). Sin backfill destructivo.

## 1. Tabla `template` — EXTENDER (columnas aditivas)

Columnas existentes (se conservan): `id`, `organization_id`, `name`, `wa_template_name`, `language`,
`category` (pasa a validarse contra el set de Meta), `body`, `created_at`, `updated_at`.

Columnas **nuevas** (todas nullables para ser aditivas sobre filas previas):

| Columna            | Tipo        | Nota |
|--------------------|-------------|------|
| `wa_template_id`   | `text`      | ID de la plantilla en Meta (HSM id). Null hasta crear/sincronizar. |
| `status`           | `text`      | Estatus de revisión (DV-WT-2). Null = "no sincronizada". |
| `rejected_reason`  | `text`      | Razón de rechazo provista por Meta (si `status=REJECTED`). |
| `quality_rating`   | `text`      | `GREEN`/`YELLOW`/`RED`/`UNKNOWN` (quality_score.score de Meta). |
| `components`       | `jsonb`     | **Modelo canónico** de componentes (ver §3). Fuente para render/preview/envío. |
| `last_synced_at`   | `timestamp` | Última reconciliación con Meta (webhook o pull). |

Índices: se conserva `template_org_idx`. Se añade índice único parcial
`template_org_name_lang_uq` sobre (`organization_id`,`wa_template_name`,`language`) para evitar duplicados
locales (Meta exige unicidad de name+language por WABA; lo reflejamos).

**Validación (Zod, capa app):**
- `category` ∈ {`MARKETING`,`UTILITY`,`AUTHENTICATION`}.
- `status` ∈ set de DV-WT-2 (valores desconocidos se guardan tal cual y la UI los muestra como "Otro").
- `wa_template_name`: `^[a-z0-9_]{1,512}$` (snake_case, minúsculas) — pre-validación antes de llamar a Meta.
- `language`: código BCP-47 de WhatsApp (p. ej. `es_MX`, `es`, `en_US`).

## 2. Tabla `template_analytics` — NUEVA (caché diaria por plantilla)

Caché de métricas para servir estadísticas sin re-pegarle a Meta en cada visita (DV-WT-7). Granularidad
**diaria**; cualquier rango se agrega sumando filas.

| Columna            | Tipo        | Nota |
|--------------------|-------------|------|
| `id`               | `text` PK   | `newId("templateAnalytics")` |
| `organization_id`  | `text` FK   | → `organization.id` (cascade). Índice. Scope de tenant. |
| `template_id`      | `text` FK   | → `template.id` (cascade). |
| `day`              | `date`      | Día (UTC) de la métrica. |
| `sent`             | `integer`   | Mensajes enviados ese día. Default 0. |
| `delivered`        | `integer`   | Entregados. Default 0. |
| `read`             | `integer`   | Leídos. Default 0. |
| `clicked`          | `integer`   | Clics en botones (si aplica). Default 0. |
| `cost`             | `numeric`   | Costo real del día (nullable = "no disponible", DV-WT-7). |
| `currency`         | `text`      | Moneda del costo (p. ej. `USD`/`MXN`), nullable. |
| `fetched_at`       | `timestamp` | Cuándo se trajo de Meta (para TTL de refresh). |

Índice único `template_analytics_tpl_day_uq` sobre (`template_id`,`day`) → upsert idempotente
(`onConflictDoUpdate`). Índice `template_analytics_org_idx` sobre (`organization_id`).

## 3. Modelo canónico de componentes (`template.components` jsonb)

Forma interna (TS + Zod en `src/lib/meta/templates.ts`). Es lo que el builder produce, lo que se traduce al
`components[]` de Meta al crear, y lo que se re-parsea al sincronizar:

```jsonc
{
  "header": {                       // opcional
    "format": "TEXT" | "IMAGE",
    "text": "Hola {{1}}",           // si TEXT (puede tener 1 variable)
    "example": "Ana"                // si TEXT con variable: valor de ejemplo
    // si IMAGE: en creación se usa header_handle (no se persiste el handle; se guarda format:IMAGE)
  },
  "body": {                         // OBLIGATORIO
    "text": "Hola {{1}}, tu visita a {{2}} es el {{3}}.",
    "variables": 3,                 // = nº de {{n}}
    "examples": ["Ana", "Depto Roma 123", "martes 3pm"]   // 1 por variable (obligatorio si variables>0)
  },
  "footer": { "text": "Inmox" },    // opcional, sin variables
  "buttons": [                      // opcional, máx 3 (mezcla permitida según reglas de Meta)
    { "type": "QUICK_REPLY", "text": "Confirmar" },
    { "type": "URL", "text": "Ver ficha", "url": "https://inmox.app/p/123" },
    { "type": "PHONE_NUMBER", "text": "Llamar", "phoneNumber": "+52..." }
  ]
}
```

**Traducción a Meta (al crear)** — `components` de la Graph API:
- `{ type:"HEADER", format:"TEXT", text, example:{ header_text:[ejemplo] } }` o
  `{ type:"HEADER", format:"IMAGE", example:{ header_handle:[handle] } }`
- `{ type:"BODY", text, example:{ body_text:[[ej1, ej2, ...]] } }`
- `{ type:"FOOTER", text }`
- `{ type:"BUTTONS", buttons:[ { type:"QUICK_REPLY", text } | { type:"URL", text, url } | { type:"PHONE_NUMBER", text, phone_number } ] }`

**Render de preview / cuerpo del hilo**: sustituir `{{i}}` por el valor i-ésimo (ejemplos en preview del
builder; valores reales al enviar desde la bandeja).

## 4. Estados y transiciones (status)

```
(crear) ─────────────▶ PENDING ──▶ APPROVED ──▶ PAUSED ⇄ APPROVED
                          │            │           
                          │            └────▶ DISABLED / PENDING_DELETION
                          └────▶ REJECTED (con rejected_reason)
APPROVED/REJECTED/… ──(eliminar)──▶ (fila borrada local + DELETE en Meta)
null (fila previa) ──(sync)──▶ estatus real de Meta  | o "no encontrada"
```

- Solo `APPROVED` es **enviable** (selector de la bandeja y validación server).
- El estatus solo cambia por **Meta** (webhook/sync), nunca a mano.
- Eliminar borra la fila local y llama `DELETE` en Meta; **no** toca `message` históricos
  (`message.template_id` queda apuntando a un id inexistente, tolerado por el render del hilo).

## 5. Entidades reutilizadas (sin cambios de esquema)

- **`metaCredentials`** (existente): provee `wabaId` + token cifrado por agencia. Su `status` puede pasar a
  `expired` ante token inválido (DV-WT-10). Se añade query `resolveOrgByWabaId(wabaId)` para el webhook.
- **`message`** (existente): un envío de plantilla desde la bandeja inserta un `message` saliente con
  `template_id` + `body` renderizado (ya soportado; se reutiliza).
