# Research — Integración de Instagram (Fase 1)

Constantes de API verificadas a jun-2026 (camino **Instagram API con Instagram Login**, host
`graph.instagram.com`). Decisiones de diseño (DV) que el plan deja resueltas. Las 4 ambigüedades de
producto se cerraron con el dueño **antes** de la spec (ver más abajo "Decisiones del dueño").

## Decisiones del dueño (pre-spec)

| Tema | Decisión |
|---|---|
| ¿IG entra a la bandeja unificada / agente IA? | **NO** — Fase 1 es módulo aislado, operación manual. |
| ¿Qué se publica? | **Ambos** — compositor genérico **y** "Publicar propiedad" (reusa fotos R2 de 007). |
| ¿Cómo se expone la imagen a Meta? | **Ruta proxy pública** en la app con token firmado (no bucket público, no presigned directa). |
| ¿Hay con qué hacer self-test E2E? | **Sí** — cuenta IG de prueba lista + app Live; Claude conduce el self-test en vivo. |

## Constantes de API (NO inventar)

- **Host Graph**: `https://graph.instagram.com/{IG_GRAPH_VERSION}` (p. ej. `v25.0`, en env var).
- **OAuth authorize**: `https://www.instagram.com/oauth/authorize`
- **Token corto (intercambio de code)**: `POST https://api.instagram.com/oauth/access_token`
  (form-urlencoded: `client_id`, `client_secret`, `grant_type=authorization_code`, `redirect_uri`, `code`).
- **Token largo (60 d)**: `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=…&access_token=<corto>`
- **Refresh (extiende 60 d)**: `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<largo>`
- **Datos de cuenta**: `GET https://graph.instagram.com/{ver}/me?fields=user_id,username&access_token=<largo>`
- **Suscribir webhooks de la cuenta**: `POST https://graph.instagram.com/{ver}/me/subscribed_apps?subscribed_fields=messages,comments&access_token=<largo>`
- **Instagram App ID**: `1019173904302571` (≠ Meta App ID `3313073622221831`).
- **Scopes Fase 1**: `instagram_business_basic`, `instagram_business_content_publish`,
  `instagram_business_manage_comments`, `instagram_business_manage_messages`.
- **Webhook fields**: `messages`, `comments`.
- **Publicar (2 pasos)**: `POST /{ver}/{ig_user_id}/media` (`image_url`, `caption`) → `creation_id`;
  luego `POST /{ver}/{ig_user_id}/media_publish` (`creation_id`) → `id` del post.
  - Reels: `media_type=REELS` + `video_url`; poll `GET /{ver}/{creation_id}?fields=status_code` hasta
    `FINISHED` antes de `media_publish`. (Solo **preparado** en Fase 1, fuera de prueba.)
  - Límite ~100 posts/24 h por cuenta: `GET /{ver}/{ig_user_id}/content_publishing_limit`.
- **Comentarios**: listar `GET /{ver}/{media_id}/comments?fields=id,text,username,timestamp`;
  responder `POST /{ver}/{comment_id}/replies` (`message`); ocultar `POST /{ver}/{comment_id}?hide=true`;
  borrar `DELETE /{ver}/{comment_id}`.
- **DM**: leer hilos `GET /{ver}/{ig_user_id}/conversations?fields=participants,messages{id,created_time,from,message}`;
  enviar `POST /{ver}/{ig_user_id}/messages` (JSON `{"recipient":{"id":"<IGSID>"},"message":{"text":"…"}}`).
  Ventana de **24 h**; fuera de ella solo `HUMAN_AGENT` (no bots) — fuera de alcance Fase 1.

---

## DV-IG-1 — Frontera nueva `src/lib/instagram` (NO extender `src/lib/meta`)

- **Decisión**: crear `src/lib/instagram/index.ts` como frontera de transporte contra
  `graph.instagram.com`, espejo de `lib/meta` pero con: base URL IG, token **por-tenant** (no default
  System User), y helpers de form-urlencoded para el intercambio OAuth.
- **Rationale**: `lib/meta.graphBaseUrl()` está clavado a `https://graph.facebook.com` y
  `graphRequest` usa por defecto `META_SYSTEM_USER_TOKEN` (WhatsApp). Reusar esa función para IG
  obligaría a parametrizar host y romper su contrato, arriesgando el canal de WhatsApp en producción.
  El Principio II exige aislar cada integración externa tras su propia frontera.
- **Reuso puntual**: `verifyWebhookSignature(rawBody, header, secret)` de `lib/meta` **sí** se reutiliza
  pasándole `IG_APP_SECRET` (ya acepta `secret` como tercer parámetro). `seal`/`open` de `lib/crypto` se
  reutilizan sin cambios.
- **Alternativa rechazada**: parametrizar `lib/meta` con host/secret/token → acopla dos canales en una
  frontera y multiplica el riesgo de regresión en WhatsApp.

## DV-IG-2 — `state` OAuth anti-CSRF firmado y sin estado en BD

- **Decisión**: el `state` es un token **HMAC-firmado** (`MEDIA_PROXY_SIGNING_SECRET` o un
  `IG_OAUTH_STATE_SECRET`; ver DV-IG-9) que codifica `{ organizationId, nonce, exp }`. En el callback se
  verifica firma + expiración (p. ej. 10 min) sin guardar nada en BD.
- **Rationale**: evita una tabla de estado efímero y su limpieza; el tenant viaja firmado en el propio
  `state`, lo que además resuelve "¿a qué agencia pertenece este callback?" sin sesión (el usuario
  vuelve de instagram.com). Patrón stateless estándar para OAuth.
- **Alternativa rechazada**: tabla `oauth_state` con TTL → más infraestructura para algo que un HMAC con
  `exp` resuelve; depender solo de la cookie de sesión → frágil si el navegador no reenvía cookie en el
  redirect de vuelta.

## DV-IG-3 — Tabla nueva `instagram_credentials` (NO extender `meta_credentials`)

- **Decisión**: tabla propia 1:1 por tenant. `meta_credentials` tiene `waba_id`/`phone_number_id`
  **NOT NULL** + UNIQUE `phone_number_id` (semántica WhatsApp) y un enum `connectionStatus`
  (connected|disconnected|expired) sin `reconnect_required`.
- **Rationale**: forzar IG en esa tabla obligaría a columnas WhatsApp NOT NULL inaplicables y a relajar
  constraints, contaminando el modelo. Tabla nueva mantiene cada canal limpio y con sus índices
  (UNIQUE `organization_id`, UNIQUE `ig_user_id`). Ver data-model.
- **Estado**: enum nuevo `ig_connection_status` = `connected | disconnected | expired |
  reconnect_required` (no mutar el enum de WhatsApp).

## DV-IG-4 — Imagen pública: ruta proxy con token HMAC por objeto

- **Decisión**: nueva ruta **pública** `GET /api/public/media/[...key]?token=<sig>&exp=<ts>`. El token es
  `HMAC(MEDIA_PROXY_SIGNING_SECRET, key + "." + exp)`; la ruta verifica firma + `exp`, y solo entonces
  **streamea** ese objeto desde R2 (`getObjectStream(key)` nuevo en `lib/storage`). Vida del token
  media (p. ej. 1 h) para tolerar reintentos de descarga de Meta.
- **Rationale**: el bucket R2 no es público y `getDownloadUrl` (presigned) expira a 15 min y filtra la
  firma S3. Un proxy con token por-objeto: (a) no expone credenciales S3, (b) sirve **solo** la key
  firmada (no permite enumerar otros objetos del tenant → Principio I), (c) URL estable y limpia para
  pasar como `image_url` a `/media`.
- **Implementación del stream**: añadir `getObjectStream(key): Promise<{ body, contentType }>` a
  `src/lib/storage` usando `GetObjectCommand` (ya importado). Se evita cargar todo el objeto en memoria.
- **Alternativa rechazada**: (a) pasar la presigned directa → expira pronto, filtra firma; (b) bucket
  público / dominio CDN → requiere config de infra del dueño y expone todo el bucket; (c) redirect 302 a
  presigned → depende de que el fetcher de Meta siga redirects (incierto). Streaming directo es el más
  robusto y autónomo.

## DV-IG-5 — Caption "desde propiedad" determinista y editable

- **Decisión**: `captionFromProperty(property)` arma un texto base con campos de `property`
  (título/operación/precio+moneda/ubicación/recámaras/baños/área) y se **pre-rellena editable** en el
  compositor antes de publicar. La imagen = foto **principal** = `property_photo` de menor `sortOrder`
  (mismo criterio que 006/007), servida por el proxy DV-IG-4.
- **Rationale**: reusa exactamente el inventario de 007 (`property` + `property_photo` ya en schema). El
  agente conserva control editorial (edita antes de publicar). Determinista = testeable.
- **Regla**: propiedad **sin** `property_photo` → se bloquea "Publicar propiedad" con mensaje claro
  (FR-012); Instagram exige imagen.

## DV-IG-6 — Renovación de tokens: endpoint protegido + tarea programada de Coolify

- **Decisión**: `POST /api/cron/instagram-refresh` protegido por `CRON_SECRET` (header o query). Recorre
  `instagram_credentials` con `status=connected` y `token_expires_at` a < ~7 días, llama
  `refresh_access_token`, actualiza `token_expires_at`. Si el refresh falla con token inválido → marca
  `reconnect_required`. Se dispara con una **scheduled task de Coolify** (diaria).
- **Rationale**: no existe cron en el repo (solo `setTimeout` en memoria para coalescencia, que no
  persiste). Un endpoint idempotente + scheduler externo es el patrón self-hostable y verificable; el
  `CRON_SECRET` evita invocación no autorizada (Principio I). Regla de Instagram: el token debe tener
  >24 h de vida para poder refrescarse — se respeta el umbral de 7 días.
- **Alternativa rechazada**: worker en proceso con `setInterval` → se pierde en redeploys/multi-instancia
  y no es observable.

## DV-IG-7 — Idempotencia del webhook IG

- **Decisión**: deduplicar por **id de evento/mensaje** de Instagram. Para `messages`, el `mid` del
  mensaje; para `comments`, el `id` del comentario. Estrategia: persistir el id en una tabla/columna con
  UNIQUE e `INSERT … ON CONFLICT DO NOTHING` (mismo patrón que WhatsApp dedup por `wa_message_id`), o —
  como en Fase 1 los DMs/comentarios no se archivan en bandeja — un registro mínimo de "eventos
  procesados" `instagram_post`/dedup. **Decisión concreta en data-model**: usar columna UNIQUE sobre el
  id del evento entrante en la tabla que persista el efecto observable; si un efecto no se persiste, no
  hay duplicado observable que evitar (la lectura de hilos es en vivo).
- **Rationale**: Meta reintenta entregas (Principio IV). Reusar el patrón ya probado en WhatsApp.

## DV-IG-8 — Enrutado multi-tenant por `ig_user_id`

- **Decisión**: el webhook resuelve el tenant con `resolveOrgByIgUserId(igUserId)` (UNIQUE en
  `instagram_credentials.ig_user_id`), espejo de `resolveOrgByPhoneNumberId` de WhatsApp. Evento cuyo
  `ig_user_id` no mapea → se descarta con log (sin error).
- **Rationale**: el payload de IG identifica la cuenta receptora; el `ig_user_id` es la llave natural de
  enrutado y ya es UNIQUE por la relación 1:1. Coherente con cómo WhatsApp enruta por `phone_number_id`.

## DV-IG-9 — Secretos y variables de entorno

- **Decisión**: variables nuevas (todas server-side, nunca al cliente):
  `IG_APP_ID`, `IG_APP_SECRET`, `IG_REDIRECT_URI`, `IG_WEBHOOK_VERIFY_TOKEN`, `IG_GRAPH_VERSION`,
  `MEDIA_PROXY_SIGNING_SECRET`, `CRON_SECRET`. `IG_APP_SECRET` firma webhooks de IG e intercambia
  tokens; es **distinto** de `META_APP_SECRET`. Se añaden a `src/lib/env.ts` (Zod) marcando opcionales
  las que, si faltan, deban **degradar** (la feature se desactiva) en vez de tumbar el arranque, según
  el patrón existente (ver memoria de env de Coolify).
- **Rationale**: Principio I (secretos por entorno) + el gotcha conocido de que una env faltante no debe
  crashear el server. `MEDIA_PROXY_SIGNING_SECRET` se reutiliza también para firmar el `state` OAuth
  (DV-IG-2) o se separa en `IG_OAUTH_STATE_SECRET` si se prefiere rotación independiente (decisión
  menor, se documenta en quickstart).

---

## Pasos manuales en Meta App Dashboard (no automatizables — pendientes de verificación humana)

1. **Caso de uso Instagram → sección "inicio de sesión empresarial"**: registrar el `IG_REDIRECT_URI`
   EXACTO (HTTPS, debe coincidir carácter a carácter con el de la URL de authorize). Sugerido:
   `https://inmox-dev.kevinbelier.cloud/api/instagram/callback`.
2. **Sección Webhooks del producto Instagram**: registrar Callback URL
   (`https://inmox-dev.kevinbelier.cloud/api/instagram/webhook`) + `IG_WEBHOOK_VERIFY_TOKEN`, y
   suscribir los fields `messages` y `comments`.
3. La app debe estar **Live** para recibir webhooks de producción.
4. Confirmar scopes de Fase 1 habilitados en el producto Instagram.

Estos pasos se detallan en quickstart.md.
