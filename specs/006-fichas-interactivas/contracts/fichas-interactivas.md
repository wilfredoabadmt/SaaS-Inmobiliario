# Contract — Fichas interactivas por WhatsApp (006)

Contrato de comportamiento e interfaces de la feature. Endpoints nuevos + payloads de Cloud API +
ruteo del tap. No es API pública para terceros.

---

## 1. Envío de la tarjeta (`src/server/inbox/ficha.ts`)

`sendPropertyCard(orgId, conv, propertyId, { withButtons })`:

```
1. Validar que la propiedad es del tenant (orgId).
2. Resolver foto principal (property_photo menor sortOrder) → URL prefirmada (getDownloadUrl).
3. Caption = formatPropertySheet(property).
4. Construir payload:
   - con foto + withButtons → interactive (header image + body caption + 3 buttons)
   - con foto + sin buttons  → image { link, caption }
   - sin foto + withButtons → interactive (body caption + 3 buttons, sin header)
   - sin foto + sin buttons  → texto (sendAgentText con el caption)   # degradación FR-004
5. Verificar ventana 24h (isServiceWindowOpen). Fuera → no enviar (agente) / error claro (manual).
6. Enviar vía graphRequest (creds del tenant) + persistir message { direction:outbound, property_id,
   body:caption, ai_generated según emisor }.
```

**Garantías**: un solo mensaje (FR-001); sin foto degrada a texto (FR-004); solo datos del tenant
(FR-005); fuera de ventana no se envía libre (FR-013).

---

## 2. Payloads de Cloud API (`src/lib/meta`)

**Imagen + caption** (`buildImagePayload`):
```json
{ "messaging_product":"whatsapp", "to":"<wa>", "type":"image",
  "image": { "link":"<url prefirmada>", "caption":"<ficha>" } }
```

**Interactivo con botones** (`buildInteractiveButtonsPayload`):
```json
{ "messaging_product":"whatsapp", "to":"<wa>", "type":"interactive",
  "interactive": {
    "type":"button",
    "header": { "type":"image", "image": { "link":"<url>" } },
    "body":   { "text":"<ficha>" },
    "action": { "buttons": [
      { "type":"reply", "reply": { "id":"visit:<propId>",   "title":"Agendar visita" } },
      { "type":"reply", "reply": { "id":"handoff:<propId>", "title":"Hablar con asesor" } },
      { "type":"reply", "reply": { "id":"photos:<propId>",  "title":"Más fotos" } }
    ] } } }
```
(El `header` se omite si no hay foto.)

---

## 3. Entrante: tap de botón (`button_reply`)

Tipos nuevos en `lib/meta` (entrante) — **verificado contra doc de Meta (2026-06-20)**:
```
message.type === "interactive"
message.interactive.type === "button_reply"
message.interactive.button_reply.id     # "<acción>:<propertyId>"  (≤256 chars)
message.interactive.button_reply.title  # texto visible
```
⚠️ NO confundir con el tap de un botón de **plantilla** (quick-reply), que llega distinto:
`message.type === "button"` con `message.button.{text,payload}`. En v1 solo manejamos la forma
**interactive/button_reply** (los botones de plantilla no se usan).

En `ingest.ts` (idempotente por `wa_message_id`, gate insert-nuevo):
```
persistir message { direction:inbound, wa_type:"interactive", body: button_reply.title }
si isNew && conv.aiEnabled? (no aplica: las acciones de botón corren con o sin agente, FR-012)
si isNew:
   after(() => handleButtonReply(orgId, conv, button_reply.id))   # ruteo
```

**Garantías**: un tap repetido (reintento) = una sola acción (FR-011/SC-006).

---

## 4. Ruteo del tap (`src/server/inbox/buttons.ts`)

`handleButtonReply(orgId, conv, buttonId)` parsea `<acción>:<propertyId>`, valida la propiedad del
tenant y rutea:

| Acción | Efecto |
|--------|--------|
| `visit` | Marca la propiedad como principal de la conversación + envía prompt "¿Qué día y hora te acomoda para visitar *<título>*?". Con agente activo, su `schedule_visit` (004) cierra al recibir la fecha; con agente off, `needs_human` para que el asesor agende. |
| `handoff` | `needs_human=true`, `needs_human_reason='requested'` (005) + confirma "Con gusto te paso con un asesor 🙌". |
| `photos` | Envía hasta 5 `property_photo` adicionales (por orden, saltando la principal). Si no hay más: "Esta propiedad no tiene más fotos por ahora." |

Todas degradan con gracia (try/catch sin secretos) y respetan la ventana 24h.

---

## 5. Endpoint del botón manual

`POST /api/conversations/[id]/ficha`
- Body: `{ propertyId: string }` (Zod).
- Auth: `requireMember` (scope de tenant).
- Efecto: `sendPropertyCard(orgId, conv, propertyId, { withButtons:true })`.
- Respuestas: `201 { id, status:"sent" }`; `409` fuera de ventana ("usa plantilla"); `404` propiedad/
  conversación no encontrada (del tenant); `422` body inválido.

`handleSendFicha` (en `inbox-client.tsx`) llama a este endpoint y deja que el poll de tiempo real
muestre el mensaje; **deja de** inyectar una burbuja local.

---

## 6. Render en la bandeja (`GET /messages`)

- El `GET` surte `property_id`; cuando no es null, hace join a `property` + foto principal y arma
  `MessageItem.kind = "property"` con el `PropertyView` para que el hilo muestre la **burbuja de
  ficha** (diseño 003). Los entrantes `button_reply` se muestran como texto (el título del botón).
