# Contracts — Endpoints de Instagram (Fase 1)

Todos los endpoints `/api/instagram/*` exigen sesión + tenant vía `getActiveContext()` salvo
`/webhook` (público, validado por firma) y `/api/public/media/[...key]` (público, validado por token
HMAC). `connect`/`callback`/`disconnect` exigen rol **owner**; el resto **owner+agent**. Todo input
externo se valida con **Zod**. Las credenciales/tokens **nunca** se devuelven al cliente.

Convención de errores: `4xx` con `{ error: { code, message } }`; degradación clara en camino infeliz
(nunca cuelgue ni estado a medias). Token de IG expirado/ inválido en cualquier operación → marca
`reconnect_required` y responde `409 { code: "reconnect_required" }`.

---

## 1. Conexión (OAuth)

### `GET /api/instagram/connect`  (owner)
- Genera `state` firmado (HMAC: `{ organizationId, nonce, exp }`, ~10 min) — DV-IG-2.
- **302** a `https://www.instagram.com/oauth/authorize?client_id={IG_APP_ID}&redirect_uri={IG_REDIRECT_URI}&response_type=code&scope={SCOPES_CSV}&state={state}`.

### `GET /api/instagram/callback?code&state`  (público vía redirect, valida state)
- Valida firma + `exp` del `state`; si falla → **302** a `/settings/instagram?ig=error` (no guarda nada).
- `code` → token corto (`POST api.instagram.com/oauth/access_token`, form) → token largo
  (`GET graph.instagram.com/access_token?grant_type=ig_exchange_token`).
- `GET /me?fields=user_id,username` → `ig_user_id`, `username`.
- Guarda `instagram_credentials` cifrado (upsert por `organization_id`), `token_expires_at` = now+60d.
- `POST /me/subscribed_apps?subscribed_fields=messages,comments`.
- **302** a `/settings/instagram?ig=connected`.
- **Errores**: state inválido → no persiste; intercambio falla → `?ig=error`.

### `POST /api/instagram/disconnect`  (owner)
- Elimina la credencial del tenant. **200** `{ ok: true }`.

### `GET /settings/instagram` (página, owner)
- Muestra estado (`getConnectionStatus(orgId)` → `{ status, username, ig_user_id, token_expires_at }`),
  tarjeta espejo de WhatsApp con **Conectar** / **Desconectar** / **Reconectar**.

---

## 2. Webhook

### `GET /api/instagram/webhook`  (público)
- Handshake: si `hub.mode=subscribe` y `hub.verify_token === IG_WEBHOOK_VERIFY_TOKEN` → **200** body
  `hub.challenge`. Si no → **403**.

### `POST /api/instagram/webhook`  (público)
- Lee **raw body**; valida `X-Hub-Signature-256` con `verifyWebhookSignature(raw, header, IG_APP_SECRET)`
  (reuso de `lib/meta`). Inválida → **401** (no procesa).
- Resuelve tenant por `ig_user_id` del payload (`resolveOrgByIgUserId`). No mapeado → **200** descarta
  con log (no error, para no provocar reintentos infinitos).
- Idempotente por id de evento (DV-IG-7). Procesa `messages` y `comments`. **200** `{ ok: true }`.

---

## 3. Publicar

### `POST /api/instagram/publish`  (owner+agent)
Body (Zod, unión discriminada por `source`):
```jsonc
// genérico
{ "source": "manual", "storageKey": "uploads/org_x/abc.jpg", "caption": "texto ≤2200" }
// desde propiedad
{ "source": "property", "propertyId": "prop_…", "caption": "opcional; default = captionFromProperty" }
```
- `manual`: la imagen ya fue subida por el cliente a R2 (presigned `getUploadUrl`, reuso). Se valida que
  `storageKey` pertenece al tenant.
- `property`: resuelve foto principal (`property_photo` menor `sort_order`); si la propiedad **no tiene
  foto** → **422** `{ code: "property_without_photo" }` (FR-012). Caption default = `captionFromProperty`.
- Construye `image_url` = URL del **proxy público** firmado (DV-IG-4) sobre la `storageKey`.
- 2 pasos: `POST /{ig}/media` (image_url, caption) → `creation_id`; `POST /{ig}/media_publish`
  (creation_id) → `ig_media_id`. Inserta `instagram_post`.
- **200** `{ igMediaId, permalink? }`.
- **Errores**: límite diario alcanzado → **429** `{ code: "rate_limited" }` (FR-013); imagen
  inaccesible / fallo en `/media` → **502** `{ code: "publish_failed" }` sin dejar post a medias.

---

### `POST /api/instagram/upload-url`  (owner+agent)
- Body: `{ contentType: "image/jpeg" | "image/png" }`. Devuelve **200** `{ uploadUrl, storageKey }`
  con la key acotada al tenant (`instagram/<orgId>/…`) para el compositor genérico. (Endpoint auxiliar
  añadido en implementación; el cliente sube por PUT a `uploadUrl` y luego llama a `/publish`.)

### `GET /api/instagram/property-caption?propertyId=`  (owner+agent)
- Devuelve **200** `{ caption, hasPhoto }` (caption derivado de la propiedad + si tiene foto) para
  pre-rellenar el compositor "Publicar propiedad". (Endpoint auxiliar añadido en implementación.)

## 4. Comentarios

### `GET /api/instagram/comments?mediaId=…`  (owner+agent)
- **200** `{ comments: [{ id, text, username, timestamp }] }` (en vivo desde Graph).

### `POST /api/instagram/comments/reply`  (owner+agent)
- Body: `{ commentId, message }`. **200** `{ id }` (id de la respuesta).

### `POST /api/instagram/comments/hide`  (owner+agent)
- Body: `{ commentId, action: "hide" | "delete" }`. `hide` → `POST /{comment}?hide=true`; `delete` →
  `DELETE /{comment}`. **200** `{ ok: true }`.

---

## 5. Mensajería (DM)

### `GET /api/instagram/conversations`  (owner+agent)
- **200** `{ threads: [{ id, participants, messages: [{ id, from, message, createdTime }] }] }`
  (en vivo desde Graph).

### `POST /api/instagram/messages`  (owner+agent)
- Body: `{ recipientIgsid, text }`. Verifica **ventana 24 h** (último mensaje entrante < 24 h); fuera de
  ventana → **422** `{ code: "outside_24h_window" }` (FR-020, sin colgarse).
- Dentro de ventana → `POST /{ig}/messages` `{recipient:{id},message:{text}}`. **200** `{ ok: true }`.

---

## 6. Proxy público de media

### `GET /api/public/media/[...key]?exp=<ts>&token=<sig>`  (público)
- Verifica `token === HMAC(MEDIA_PROXY_SIGNING_SECRET, key + "." + exp)` y `exp` no vencido
  (DV-IG-4). Inválido/vencido → **403**.
- Streamea el objeto desde R2 (`getObjectStream(key)`) con su `Content-Type`. **200** bytes.
- **Solo** sirve la key firmada (no enumera ni acepta keys arbitrarias sin firma) → Principio I.

---

## 7. Cron de refresh

### `POST /api/cron/instagram-refresh`  (protegido por `CRON_SECRET`)
- Auth: header `X-Cron-Secret` (o query) === `CRON_SECRET`. Inválido → **401**.
- Recorre `instagram_credentials` con `status=connected` y `token_expires_at` < now+7d; `refresh` cada
  uno; actualiza `token_expires_at`. Token inválido → `status=reconnect_required`.
- **200** `{ refreshed, marked_reconnect, skipped }`.
- Disparado por **scheduled task de Coolify** (diaria) — DV-IG-6.

---

## Resumen de rutas

| Método | Ruta | Rol | Público |
|---|---|---|---|
| GET | `/api/instagram/connect` | owner | no |
| GET | `/api/instagram/callback` | (state) | redirect |
| POST | `/api/instagram/disconnect` | owner | no |
| GET/POST | `/api/instagram/webhook` | — | sí (firma) |
| POST | `/api/instagram/publish` | owner+agent | no |
| GET | `/api/instagram/comments` | owner+agent | no |
| POST | `/api/instagram/comments/reply` | owner+agent | no |
| POST | `/api/instagram/comments/hide` | owner+agent | no |
| GET | `/api/instagram/conversations` | owner+agent | no |
| POST | `/api/instagram/messages` | owner+agent | no |
| GET | `/api/public/media/[...key]` | — | sí (token HMAC) |
| POST | `/api/cron/instagram-refresh` | CRON_SECRET | sí (secret) |
