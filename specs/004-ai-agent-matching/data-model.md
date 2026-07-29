# Data Model — Agente de IA + matching (004)

**Feature**: `004-ai-agent-matching` · **Date**: 2026-06-19

Migración **aditiva** sobre `src/lib/db/schema/domain.ts` (Drizzle). No rompe datos existentes.

## Entidad nueva: `client_requirements`

Requisitos de búsqueda de un cliente. **1:1 por cliente** (upsert por `organization_id` +
`client_id`). Origen `ai` (extraído por el agente) o `manual` (capturado/editado por el asesor).

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | text PK | prefijo nanoid |
| `organizationId` | text FK → organization | NOT NULL, indexado (scope de tenant) |
| `clientId` | text FK → client (cascade) | NOT NULL, **UNIQUE por org** |
| `operation` | enum `operation_type` (renta/venta) | nullable hasta calificar |
| `budgetMin` | numeric(14,2) | nullable |
| `budgetMax` | numeric(14,2) | nullable; si el cliente da un solo número → objetivo ±15% en scoring (D8) |
| `zone` | text | colonia/ciudad de interés; nullable |
| `propertyType` | enum `property_type` | nullable |
| `bedrooms` | integer | nullable |
| `bathrooms` | numeric(3,1) | nullable |
| `notes` | text | señales libres ("acepta mascotas", "mudanza urgente") |
| `source` | text (`ai`\|`manual`) | default `ai` |
| `version` | integer | se incrementa en cada cambio → invalida la caché de matches |
| `updatedAt` | timestamp | defaultNow, se toca en cada upsert |

Índices: `client_requirements_org_idx (organizationId)`, UNIQUE
`client_requirements_org_client_uq (organizationId, clientId)`.

**Merge (D8)**: al actualizar, los campos no mencionados en el turno **se conservan** (no se borran);
`version` se incrementa solo si cambió algún campo.

## Entidades extendidas

### `conversation` (+2 columnas)

| Campo nuevo | Tipo | Default | Significado |
|---|---|---|---|
| `aiEnabled` | boolean | `false` | El agente está activo en esta conversación (opt-in, FR-005). |
| `needsHuman` | boolean | `false` | Handoff: requiere atención humana; el agente queda en pausa (FR-013/14). |

### `message` (+1 columna)

| Campo nuevo | Tipo | Default | Significado |
|---|---|---|---|
| `aiGenerated` | boolean | `false` | El mensaje saliente lo generó el agente (vs un humano). FR-010. |

> El autor se deriva: `inbound` = cliente; `outbound` + `aiGenerated` = agente; `outbound` +
> `senderUserId` = asesor humano.

## View models (consumidos por la UI; mismo contrato visual de 003)

- **Match (calculado)**: `property: PropertyView`, `pct: 0–100`, `reasons: {ok,label}[]`,
  `why: string`. Producido por `server/matching/engine.ts`. Reemplaza el fixture del panel.
- **ClientRequirements (view)**: forma de `client_requirements` para los chips del panel y el editor.
- **ConversationAgentState**: `aiEnabled`, `needsHuman` → toggle + badge en la bandeja.

## Relaciones

```
client (1) ──< conversation (N)            (DV-4)
client (1) ──(1) client_requirements        ← NUEVO
client_requirements + property[tenant] ──► Match[]   (motor de matching)
conversation ──< message (N)  · message.aiGenerated distingue agente/humano
agent (acción schedule_visit) ──► showing (existente)
```

## Transiciones de estado

**Agente por conversación**:
```
(ai desactivado) --activar(asesor)--> (ai activo)
(ai activo) --handoff(cierre/sensible/"quiero asesor")--> (needs_human=true, ai en pausa)
(needs_human=true) --reanudar(asesor)--> (ai activo, needs_human=false)
(ai activo) --desactivar(asesor)--> (ai desactivado)
```

**Calificación**: requisitos pasan de vacíos → parciales → completos conforme el agente extrae datos;
cada cambio sube `version` y recomputa matches.

## Sin cambios

No se modifican `property`, `client` (salvo la relación), `showing`, `template`, `meta_credentials`,
ni el contrato del webhook. La idempotencia sigue anclada al UNIQUE `message.wa_message_id`.
