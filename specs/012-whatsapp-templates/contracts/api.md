# API Contracts — 012-whatsapp-templates

Todos los endpoints: scope por `organization_id` (`requireMember`/`requireOwner`), `dynamic="force-dynamic"`.
Errores estándar: `{ error: { code, message } }`. Token de WhatsApp nunca en respuestas ni logs.

Códigos de error comunes: `unauthorized` (401), `forbidden` (403, no-owner), `not_found` (404),
`invalid` (422 validación local), `meta_error` (422/400, con `message` legible de Meta, DV-WT-11),
`reconnect_required` (409, token inválido, DV-WT-10), `not_connected` (409, sin WhatsApp),
`meta_unavailable` (503, 5xx/timeout de Meta).

---

## GET /api/templates  *(member)*

Lista las plantillas de la agencia con estatus y componentes.

**200** →
```jsonc
{ "templates": [ {
  "id": "template_...", "name": "Recordatorio de visita", "waTemplateName": "recordatorio_visita",
  "language": "es_MX", "category": "UTILITY",
  "status": "APPROVED",            // o null = "no sincronizada"
  "rejectedReason": null, "qualityRating": "GREEN",
  "components": { /* modelo canónico, data-model §3 */ },
  "lastSyncedAt": "2026-06-25T..." } ] }
```

## POST /api/templates  *(owner)* — crear + enviar a revisión

**Body**:
```jsonc
{ "name": "Recordatorio de visita", "waTemplateName": "recordatorio_visita",
  "language": "es_MX", "category": "UTILITY",
  "components": { /* modelo canónico; si header IMAGE incluye headerHandle de upload-sample */ } }
```
Server: valida (Zod + snake_case) → traduce a `components[]` de Meta → `POST /{waba_id}/message_templates`
con el token de la agencia → si OK inserta fila local con `wa_template_id` + `status` devuelto (normalmente
`PENDING`). Si Meta rechaza la **creación**, **no** inserta fila y devuelve `meta_error` con mensaje legible.

**201** → `{ "id": "template_...", "status": "PENDING" }`
**Errores**: `invalid` (422), `forbidden` (403), `not_connected` (409), `reconnect_required` (409),
`meta_error` (422, p. ej. nombre duplicado), `meta_unavailable` (503).

## POST /api/templates/upload-sample  *(owner)* — handle de imagen para header

Recibe la imagen de muestra (multipart o base64) y devuelve el `header_handle` (Resumable Upload, DV-WT-5).
**200** → `{ "handle": "4::aW1h...":..." }` · **Errores**: `invalid`, `reconnect_required`, `meta_unavailable`.

## POST /api/templates/sync  *(owner)* — reconciliar estatus desde Meta

Server: `GET /{waba_id}/message_templates` (paginado) → upsert de `status/components/rejected_reason/
quality_rating/wa_template_id/last_synced_at` de todas las plantillas (match por `wa_template_id` o
`name+language`). Filas locales sin correspondencia en Meta → `status="not_found"` (UI sugiere recrear).
**200** → `{ "synced": 7, "updated": 3 }` · **Errores**: `reconnect_required`, `not_connected`, `meta_unavailable`.

## DELETE /api/templates/[id]  *(owner)*

Server: `DELETE /{waba_id}/message_templates?name={waTemplateName}&hsm_id={wa_template_id}` → si OK borra la
fila local. No toca `message` históricos.
**200** → `{ "deleted": true }` · **Errores**: `not_found`, `forbidden`, `reconnect_required`, `meta_error`,
`meta_unavailable`.

## GET /api/templates/[id]/analytics?start=&end=  *(member)* — stats de UNA plantilla

`start`/`end` = ISO date (UTC). Sirve de caché `template_analytics`; si el rango (o parte) no está cacheado o
el cache excede TTL, refresca vía `GET /{waba_id}/template_analytics` y hace upsert por día.
**200** →
```jsonc
{ "templateId":"template_...",
  "range": { "start":"2026-06-01", "end":"2026-06-25" },
  "totals": { "sent":120, "delivered":118, "read":90, "clicked":12,
              "cost": 3.45, "currency":"USD" },   // cost=null si Meta no lo expone (DV-WT-7)
  "daily": [ { "day":"2026-06-01", "sent":10, "delivered":10, "read":8, "clicked":1, "cost":0.29 } ],
  "costAvailable": true }
```
**Errores**: `not_found`, `reconnect_required`, `meta_unavailable`. **Sin datos** (cuenta nueva / ventana de
procesamiento) → 200 con totales en 0 y `costAvailable:false` (no error).

## GET /api/templates/analytics?start=&end=  *(member)* — resumen agregado de la agencia

Suma de todas las plantillas de la org en el rango (desde caché).
**200** → `{ "range":{...}, "totals":{ sent, delivered, read, clicked, cost, currency, costAvailable },
"byTemplate":[ { templateId, name, sent, delivered, read, clicked, cost } ] }`

---

## EXTENDER · POST /api/conversations/[id]/messages/template  *(member)* — envío con variables

**Body** (extiende el actual `{ templateId }`):
```jsonc
{ "templateId": "template_...",
  "variables": ["Ana", "Depto Roma 123", "martes 3pm"] }   // posicional, body; [] si no tiene variables
```
Server (DV-WT-9): valida plantilla **APPROVED** + de la org; valida `variables.length === components.body.variables`;
construye `template:{ name, language:{code}, components:[{type:"body", parameters:[{type:"text",text:v}...]}] }`;
envía; inserta `message` saliente con `body` renderizado (`{{i}}`→valor) + `template_id`.
**201** → `{ "id":"message_...", "status":"sent" }`
**Errores**: `not_found` (conv/plantilla), `invalid` (422, no aprobada o faltan variables),
`reconnect_required`, `not_connected`, `meta_error`, `meta_unavailable`.

---

## EXTENDER · POST /api/webhooks/whatsapp  — campo `message_template_status_update`

Hoy el handler descarta cambios sin `phone_number_id`. **Cambio**: antes de exigir `phone_number_id`, si
`change.field === "message_template_status_update"`, resolver la org por **`entry.id` (waba_id)** vía
`resolveOrgByWabaId` y llamar `processTemplateStatusUpdate(orgId, change.value)`.

`change.value` (de Meta):
```jsonc
{ "event": "APPROVED",            // APPROVED | REJECTED | PAUSED | DISABLED | PENDING | ...
  "message_template_id": 123456789,
  "message_template_name": "recordatorio_visita",
  "message_template_language": "es_MX",
  "reason": null }                // string si REJECTED
```
`processTemplateStatusUpdate`: localizar la fila por `wa_template_id` (o `name+language`), aplicar
`status=event`, `rejected_reason=reason`, `last_synced_at=now`. **Idempotente** (set; re-procesar no cambia).
Si no hay fila local (plantilla creada fuera del producto), opcionalmente upsert mínimo o ignorar (se ignora
en v1, el Sync la traerá). Siempre responde **200** (ack) aunque no haya match.

*(Opcional, mismo ruteo)*: `message_template_quality_update` → actualizar `quality_rating`. `template_category_update`
→ actualizar `category`. No bloqueantes para el MVP.
