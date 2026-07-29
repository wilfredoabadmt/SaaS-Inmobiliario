# Contract — WhatsApp Webhook (entrante de Meta)

Endpoint público que recibe los eventos de WhatsApp Cloud API. Es la frontera externa
más sensible: concentra **verificación de firma** (Principio I) e **idempotencia**
(Principio IV / FR-005).

Ruta: `/api/webhooks/whatsapp`

---

## GET `/api/webhooks/whatsapp` — verificación de suscripción

Meta llama una vez al registrar el webhook.

**Query params**: `hub.mode`, `hub.verify_token`, `hub.challenge`.

**Comportamiento**:
- Si `hub.mode == "subscribe"` **y** `hub.verify_token == META_WEBHOOK_VERIFY_TOKEN`
  → responder `200` con el cuerpo = `hub.challenge` (texto plano).
- En caso contrario → `403`.

---

## POST `/api/webhooks/whatsapp` — recepción de eventos

**Headers**: `X-Hub-Signature-256: sha256=<hmac>`.

**Validación de firma (antes de parsear el negocio)**:
1. Calcular `HMAC-SHA256(raw_body, META_APP_SECRET)`.
2. Comparar en tiempo constante contra el header.
3. Si no coincide → `401` y **no** se procesa nada.

**Payload (forma relevante)**:
```jsonc
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<waba_id>",
    "changes": [{
      "field": "messages",
      "value": {
        "metadata": { "phone_number_id": "<phone_number_id>" },
        "contacts": [{ "wa_id": "<e164>", "profile": { "name": "..." } }],
        "messages": [{ "id": "wamid....", "from": "<e164>", "timestamp": "...",
                       "type": "text", "text": { "body": "..." } }],
        "statuses": [{ "id": "wamid....", "status": "delivered|read|failed", "...": "..." }]
      }
    }]
  }]
}
```

**Procesamiento (idempotente)**:
1. Resolver la **organización** por `phone_number_id` → `meta_credentials`. Si no
   mapea a ninguna agencia → `200` (ack) y descartar.
2. Por cada `message`:
   - `INSERT … ON CONFLICT (wa_message_id) DO NOTHING` (dedup; reintentos de Meta no
     duplican — FR-005/SC-003).
   - Si el `client` (por `wa_id`) no existe en la organización → crearlo; vincular o
     crear la `conversation`; insertar el `message` (inbound); actualizar
     `last_message_at`.
3. Por cada `status` → actualizar `message.status` del mensaje saliente.
4. **Siempre** responder `200` rápidamente tras encolar/persistir (Meta reintenta
   ante no-2xx). El trabajo pesado no debe bloquear el ack.

**Respuestas**: `200` (procesado/ack) · `401` (firma inválida) · `403` (verificación
GET fallida).

**Notas de cumplimiento**:
- Idempotencia garantizada por el UNIQUE en `message.wa_message_id` (durable).
- La firma se valida sobre el **raw body** exacto (sin reserializar).
