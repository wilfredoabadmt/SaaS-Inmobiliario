# Contratos de API: 010-sales-pipeline

Todos los endpoints bajo `/api/pipeline`. Autorización:
- **`requireMember`** (owner+agent): tablero, crear trato, mover/asignar, detalle.
- **`requireOwner`**: CRUD de etapas (configurar embudo).

Convenciones del proyecto: validación **Zod** en todo input; errores `{ error: { code, message } }`;
scope por `organization_id` **siempre** (recurso de otra org → `404 not_found`, no `403`, para no filtrar
existencia). IDs `text` con prefijo. Sin secretos en respuestas.

> **Auto-alta por inbound (NO es endpoint)**: el trato en la etapa inicial se crea **server-side** en
> `src/server/inbox/ingest.ts` cuando entra el primer inbound de un contacto (DV-SP-6), no por una llamada
> del cliente. El `POST /api/pipeline/deals` de abajo es solo para el **alta manual** desde la UI.
>
> **Regla de avance (DV-SP-8)**: el `PATCH …/deals/[id]` **manual** mueve a cualquier etapa (el humano
> decide). La regla "solo avanzar" aplica únicamente a las **automatizaciones** (visita ahora; IA en 011),
> vía el helper `advanceStageForward`, no a este endpoint.

---

## 1. `GET /api/pipeline` — Tablero

Devuelve el embudo de la org (etapas ordenadas) + los tratos agrupados, **omitiendo** tratos con cliente o
propiedad archivados (007/009). Si la org no tiene etapas sembradas, las siembra (idempotente) y devuelve
las 8 por defecto. — **`requireMember`**

**200**:
```json
{
  "stages": [
    { "id": "pst_a1", "label": "Nuevo", "sortOrder": 0, "kind": "normal", "color": "--stage-nuevo" }
  ],
  "deals": [
    {
      "id": "cand_x1",
      "stageId": "pst_a1",
      "client": { "id": "cli_1", "name": "Ana Martínez", "channel": "whatsapp" },
      "property": { "id": "prop_1", "title": "Depto en Polanco", "operationType": "renta" },
      "assignedAgent": { "id": "usr_2", "name": "Carlos R." },
      "updatedAt": "2026-06-24T18:00:00.000Z"
    }
  ]
}
```
- `property` puede ser `null` (trato sin propiedad). `assignedAgent` puede ser `null` ("Sin asignar").
- Notas: el cliente arma `byStage` agrupando `deals` por `stageId`. El conteo por columna = nº de deals.

---

## 2. `POST /api/pipeline/deals` — Crear trato (alta mínima desde el pipeline)

— **`requireMember`**

**Body** (Zod):
```json
{ "clientId": "cli_1", "propertyId": "prop_1" | null, "stageId": "pst_a1" | null }
```
- `clientId` obligatorio, debe ser cliente **de la org** y no archivado → si no, `404`.
- `propertyId` opcional; si viene, debe ser propiedad **de la org** y no archivada → si no, `404`.
- `stageId` opcional; default = primera etapa (`sort_order` mínima, normalmente "Nuevo"). Debe ser etapa de
  la org → si no, `400 invalid_stage`.

**201**: `{ "id": "cand_new", "stageId": "pst_a1" }`
**409 `duplicate_deal`**: ya existe ese trato cliente×propiedad (o ya hay un trato sin-propiedad del cliente).

---

## 3. `GET /api/pipeline/deals/[id]` — Detalle del trato (panel/drawer)

Compone datos ya existentes (DV-SP-4). Garantiza `conversationId` con `getOrCreateConversation`. —
**`requireMember`**, scoped (otro tenant → `404`).

**200**:
```json
{
  "id": "cand_x1",
  "stageId": "pst_a1",
  "client": {
    "id": "cli_1", "name": "Ana Martínez", "phone": "+52 55 1234 5678", "channel": "whatsapp"
  },
  "requirements": {
    "operation": "renta", "budgetLabel": "$25–30k", "zone": "Polanco", "propertyType": "departamento",
    "bedrooms": 2, "bathrooms": 2
  } | null,
  "property": {
    "id": "prop_1", "title": "Depto en Polanco", "operationType": "renta", "photoUrl": "https://…signed" 
  } | null,
  "conversationId": "conv_1",
  "recentMessages": [
    { "id": "m5", "direction": "inbound", "body": "¿El jueves se puede?", "createdAt": "…" }
  ],
  "assignedAgent": { "id": "usr_2", "name": "Carlos R." } | null
}
```
- `recentMessages`: últimos ~5, orden cronológico. `photoUrl`: URL prefirmada efímera (007) o ausente.
- El botón "Abrir en bandeja" del cliente navega a `/inbox?c=<conversationId>` (no hay reglas de canal aquí).

---

## 4. `PATCH /api/pipeline/deals/[id]` — Mover etapa y/o asignar agente

Un solo endpoint para las dos mutaciones del trato. — **`requireMember`**, scoped.

**Body** (Zod, ambos opcionales pero al menos uno):
```json
{ "stageId": "pst_b2", "assignedAgentId": "usr_3" | null }
```
- `stageId`: debe ser etapa **de la org** → si no existe (p. ej. otro miembro la borró), `400 invalid_stage`
  y el cliente refresca (Edge concurrencia). Mover a la misma etapa = no-op idempotente.
- `assignedAgentId`: debe ser **`member` de la org** → si no, `400 not_a_member` (FR-024). `null` = "Sin asignar".

**200**: el trato actualizado (misma forma que un item de `deals`).
**404**: trato de otra org / inexistente.

---

## 5. `GET /api/pipeline/stages` — Listar etapas (config)

Lista ordenada para el modo "Configurar etapas". — **`requireOwner`** (la lectura del tablero pública ya
viene en `GET /api/pipeline`; este es el de configuración).

**200**: `{ "stages": [ { "id", "label", "sortOrder", "kind", "deletable": true|false, "dealCount": 3 } ] }`
- `deletable` = `kind === "normal"`. `dealCount` para avisar antes de borrar (FR-012).

---

## 6. `POST /api/pipeline/stages` — Crear etapa — **`requireOwner`**

**Body**: `{ "label": "Precalificado", "afterStageId": "pst_a2" | null }`
- Inserta una etapa `kind:"normal"` tras `afterStageId` (o al final); recalcula `sort_order`.
- `label` no vacío (Zod). 

**201**: `{ "id": "pst_new", "sortOrder": 3 }`

---

## 7. `PATCH /api/pipeline/stages/[id]` — Renombrar / mover una etapa — **`requireOwner`**

**Body** (al menos uno): `{ "label": "Nuevo nombre", "sortOrder": 2 }`
- Renombrar: permitido también para anclas (cambia `label`, no `kind`).
- `sortOrder`: reubica la etapa (las demás se recalculan).
**200**: etapa actualizada. **404**: etapa de otra org.

---

## 8. `PUT /api/pipeline/stages/order` — Reordenar atómico — **`requireOwner`**

**Body**: `{ "orderedIds": ["pst_a1","pst_a3","pst_a2", "…"] }`
- Debe contener **exactamente** el conjunto de etapas de la org → si falta/sobra, `400 invalid_order`.
- Reasigna `sort_order` por posición en un solo paso (evita estados intermedios).
**200**: `{ "ok": true }`

---

## 9. `DELETE /api/pipeline/stages/[id]` — Eliminar etapa — **`requireOwner`**

- **Rechaza** si `kind <> 'normal'` → `400 anchor_stage` (anclas indelebles, FR-010).
- Si la etapa **tiene tratos**: requiere `?reassignToStageId=pst_x` (otra etapa de la org) para **mover**
  esos tratos antes de borrar; sin él → `409 stage_not_empty` con `dealCount` (FR-012). El FK `RESTRICT`
  es la última red de seguridad a nivel BD.
**200**: `{ "ok": true, "reassigned": 3 }`

---

## Resumen de guards y códigos

| Endpoint | Guard | Errores notables |
|---|---|---|
| `GET /api/pipeline` | member | — |
| `POST /api/pipeline/deals` | member | 404 client/property, 400 invalid_stage, 409 duplicate_deal |
| `GET /api/pipeline/deals/[id]` | member | 404 |
| `PATCH /api/pipeline/deals/[id]` | member | 400 invalid_stage, 400 not_a_member, 404 |
| `GET /api/pipeline/stages` | **owner** | 403 |
| `POST /api/pipeline/stages` | **owner** | 403, 400 |
| `PATCH /api/pipeline/stages/[id]` | **owner** | 403, 404 |
| `PUT /api/pipeline/stages/order` | **owner** | 403, 400 invalid_order |
| `DELETE /api/pipeline/stages/[id]` | **owner** | 403, 400 anchor_stage, 409 stage_not_empty |

Aislamiento de tenant (Edge): cualquier `[id]` de otra org responde `404 not_found` (no `403`).
