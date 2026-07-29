---
description: "Task list — Integración de Instagram (Fase 1)"
---

# Tasks: Integración de Instagram (Fase 1)

**Input**: Design documents from `specs/008-instagram-integration/`

**Prerequisites**: plan.md, spec.md, research.md (DV-IG-1…9), data-model.md, contracts/instagram-api.md, quickstart.md

**Tests**: Este proyecto NO usa test-files TDD. La Definición de Hecho REFORZADA es
typecheck + lint + build **+ self-test E2E de comportamiento en vivo** (lo conduce Claude). Por eso
cada historia termina con una tarea de **verificación de comportamiento** (no archivos de test), y hay
una verificación consolidada en Polish.

**Organization**: Tareas agrupadas por historia de usuario para implementación/verificación
independiente. Prefijos de ID en `T0xx`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1…US5 (mapea a las historias de spec.md)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Monolito Next.js: `src/app`, `src/components`, `src/lib`, `src/server`. Rutas según plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuración base para que el resto compile y degrade sin credenciales.

- [x] T001 Añadir las 7 variables de entorno de IG al esquema Zod en `src/lib/env.ts`
  (`IG_APP_ID`, `IG_APP_SECRET`, `IG_REDIRECT_URI`, `IG_WEBHOOK_VERIFY_TOKEN`, `IG_GRAPH_VERSION`,
  `MEDIA_PROXY_SIGNING_SECRET`, `CRON_SECRET`), marcándolas **opcionales/degradables** (si faltan, la
  feature de IG se desactiva en vez de tumbar el arranque — gotcha de env de Coolify). Ver research DV-IG-9.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema, frontera de transporte y módulo de credenciales que **todas** las historias usan.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [x] T002 Añadir a `src/lib/db/schema/domain.ts`: enum `ig_connection_status`
  (`connected|disconnected|expired|reconnect_required`) + tabla `instagram_credentials` (1:1 por tenant,
  UNIQUE `organization_id` y UNIQUE `ig_user_id`, token cifrado) + tabla `instagram_post`
  (UNIQUE `ig_media_id`, `property_id` FK set null). Aditivo, sin tocar `meta_credentials`. Ver data-model.md.
- [x] T003 Generar la migración Drizzle en `drizzle/` para el enum + 2 tablas y verificar que es
  **aditiva** (no destructiva); confirmar que aplica en el arranque/Pre-Deployment.
- [x] T004 [P] Crear la **frontera de transporte** `src/lib/instagram/index.ts`: `igGraphBaseUrl()`
  (`https://graph.instagram.com/{IG_GRAPH_VERSION}`), `igGraphRequest<T>()` (token por-tenant, maneja
  `MetaApiError`), builders de URL OAuth (authorize / exchange corto / exchange largo / refresh),
  `subscribeInstagramWebhooks(token)` (`POST /me/subscribed_apps?subscribed_fields=messages,comments`),
  builders de payload (publish/comment/message) y tipos del webhook entrante. Reusa
  `verifyWebhookSignature` de `src/lib/meta` pasándole `IG_APP_SECRET`. Ver research DV-IG-1 + constantes.
- [x] T005 [P] Crear `src/server/instagram/credentials.ts`: `saveCredentials(orgId, …)` (cifra con
  `seal` de `src/lib/crypto`), `getCredentials(orgId)` (descifra con `open`), `deleteCredentials(orgId)`,
  `getConnectionStatus(orgId)` (devuelve `{status,username,igUserId,tokenExpiresAt}` **sin token**),
  `resolveOrgByIgUserId(igUserId)` y `markReconnectRequired(orgId)`. Scoped por `organization_id`.

**Checkpoint**: Esquema migrado + transporte + credenciales listos → las historias pueden comenzar.

---

## Phase 3: User Story 1 - Conectar la cuenta de Instagram (Priority: P1) 🎯 MVP

**Goal**: La agencia conecta su cuenta IG por OAuth desde Configuración; queda guardada cifrada y se
muestra `@usuario`. Cimiento de todo el canal.

**Independent Test**: Conectar la cuenta IG de prueba → fila en `instagram_credentials` (token cifrado,
`token_expires_at` ~60 d, `@usuario`) → desconectar vuelve al estado inicial; callback con `state`
inválido se rechaza sin guardar.

### Implementation for User Story 1

- [x] T006 [US1] Crear `src/server/instagram/oauth.ts`: `signState(orgId)` / `verifyState(state)`
  (HMAC con `MEDIA_PROXY_SIGNING_SECRET` + `exp` ~10 min, codifica `organizationId`),
  `exchangeCodeForShortToken(code)`, `exchangeShortForLongToken(short)`, `fetchMe(longToken)` →
  `{user_id, username}`. Usa la frontera `src/lib/instagram`. Ver research DV-IG-2.
- [x] T007 [US1] Crear `src/app/api/instagram/connect/route.ts` (GET, **owner**): genera `state` firmado y
  responde **302** a `https://www.instagram.com/oauth/authorize` con `client_id`, `redirect_uri`,
  `response_type=code`, `scope` (CSV de los 4 scopes) y `state`.
- [x] T008 [US1] Crear `src/app/api/instagram/callback/route.ts` (GET): valida `state` (firma + `exp`);
  intercambia `code`→corto→largo; `fetchMe`; `saveCredentials` (`token_expires_at`=now+60 d);
  `subscribeInstagramWebhooks`; **302** a `/settings/instagram?ig=connected`. State/intercambio inválido
  → `?ig=error` sin persistir. Ver contracts §1.
- [x] T009 [P] [US1] Crear `src/app/api/instagram/disconnect/route.ts` (POST, **owner**):
  `deleteCredentials(orgId)` → **200** `{ok:true}`.
- [x] T010 [P] [US1] Crear `src/components/instagram/instagram-connect-card.tsx`: tarjeta espejo de la de
  WhatsApp con botón **Conectar** (→ `/api/instagram/connect`), y si está conectada muestra `@usuario` +
  estado + **Desconectar**; si `reconnect_required`/`expired` muestra **Reconectar**.
- [x] T011 [US1] Crear `src/app/(dashboard)/settings/instagram/page.tsx` (guard **owner** vía
  `getActiveContext`): carga `getConnectionStatus(orgId)` y renderiza `instagram-connect-card`.
- [x] T012 [US1] Modificar `src/app/(dashboard)/settings/page.tsx`: añadir tarjeta "Instagram —
  Conecta tu cuenta de Instagram" enlazando a `/settings/instagram` (espejo de la tarjeta de WhatsApp).
- [ ] T013 [US1] **Verificación de comportamiento — LIVE, PENDIENTE HUMANO**: conectar la cuenta IG de prueba y
  comprobar fila cifrada en `instagram_credentials`; desconectar; provocar `state` inválido y comprobar
  rechazo. Registrar evidencia. (quickstart.md §5 paso 1 + camino infeliz state)

**Checkpoint**: US1 funcional e independientemente verificable (cuenta conectada/desconectada).

---

## Phase 4: User Story 2 - Publicar una imagen (compositor y desde propiedad) (Priority: P1)

**Goal**: Publicar una imagen (subida libre o desde una propiedad de 007) en el perfil real de IG, en 2
pasos, sirviendo la imagen por el proxy público.

**Independent Test**: Publicar por compositor → post visible; "Publicar propiedad" pre-rellena foto
principal + caption derivado y publica; propiedad sin foto se bloquea; la imagen se sirve por la ruta
proxy. (Requiere una cuenta conectada de US1 para ejercerlo en vivo; el código es independiente.)

### Implementation for User Story 2

- [x] T014 [P] [US2] Añadir `getObjectStream(key)` a `src/lib/storage/index.ts` (usa `GetObjectCommand`,
  devuelve `{body, contentType}` sin cargar todo en memoria). Ver research DV-IG-4.
- [x] T015 [P] [US2] Crear `src/lib/instagram/media-token.ts`: `signMediaToken(key, exp)` /
  `verifyMediaToken(key, exp, token)` (HMAC con `MEDIA_PROXY_SIGNING_SECRET`) y `buildPublicImageUrl(key)`
  (URL absoluta al proxy con `exp` ~1 h + token).
- [x] T016 [US2] Crear `src/app/api/public/media/[...key]/route.ts` (GET, **público**): valida
  `verifyMediaToken` + `exp`; si ok streamea el objeto desde `getObjectStream` con su `Content-Type`;
  inválido/vencido → **403**. Sirve **solo** la key firmada. Ver contracts §6.
- [x] T017 [P] [US2] Crear `src/lib/instagram/schemas.ts`: Zod del publish (unión discriminada
  `source: "manual" | "property"`) reutilizable cliente/servidor.
- [x] T018 [US2] Crear `src/server/instagram/publish.ts`: `captionFromProperty(property)` (texto base
  determinista), resolución de foto principal (`property_photo` menor `sort_order`),
  `createMediaContainer(igUserId,token,imageUrl,caption)` → `creation_id`,
  `publishMedia(igUserId,token,creation_id)` → `ig_media_id`, `checkPublishingLimit()`. Inserta
  `instagram_post`. Ver research DV-IG-5.
- [x] T019 [US2] Crear `src/app/api/instagram/publish/route.ts` (POST, **owner+agent**): valida Zod;
  `manual` (valida `storageKey` del tenant) o `property` (foto principal; sin foto → **422**
  `property_without_photo`); construye `image_url` con `buildPublicImageUrl`; ejecuta los 2 pasos; límite
  diario → **429** `rate_limited`; fallo de publicación → **502** `publish_failed` sin post a medias.
  Token inválido → **409** `reconnect_required` + `markReconnectRequired`. Ver contracts §3.
- [x] T020 [P] [US2] Crear `src/components/instagram/property-picker.tsx`: selector de propiedad (lista
  scoped del tenant) para "Publicar propiedad".
- [x] T021 [US2] Crear `src/app/(dashboard)/instagram/page.tsx`: shell del módulo IG (pestañas Publicar ·
  Comentarios · DMs), **separado de la bandeja**, con guard de tenant.
- [x] T022 [US2] Crear `src/app/(dashboard)/instagram/composer.tsx`: compositor que (a) sube imagen a R2
  por presigned (`getUploadUrl`, reuso) + caption, o (b) elige propiedad (pre-rellena foto+caption
  editable) y llama a `/api/instagram/publish`.
- [ ] T023 [US2] **Verificación de comportamiento — LIVE, PENDIENTE HUMANO**: publicar imagen genérica (post visible),
  publicar desde propiedad (foto principal + caption), propiedad sin foto bloqueada, imagen accesible vía
  proxy. Registrar evidencia; render visual del post → **pendiente humano**. (quickstart.md §5 pasos 2-3)

**Checkpoint**: US1 + US2 funcionales (conectar + publicar) = MVP del canal.

---

## Phase 5: User Story 3 - Moderar comentarios (Priority: P2)

**Goal**: Listar comentarios de una publicación, responder, ocultar/borrar. Lectura en vivo (sin webhook).

**Independent Test**: Sobre un post con comentarios: listar (autor/texto/fecha), responder uno (aparece
en IG), ocultar otro (deja de verse). Requiere cuenta conectada (US1) y un post (US2) para ejercerlo.

### Implementation for User Story 3

- [x] T024 [US3] Crear `src/server/instagram/comments.ts`: `listComments(orgId, mediaId)`,
  `replyComment(orgId, commentId, message)`, `hideComment(orgId, commentId)`,
  `deleteComment(orgId, commentId)`. Carga token del tenant vía `getCredentials`. Ver contracts §4.
- [x] T025 [P] [US3] Crear `src/app/api/instagram/comments/route.ts` (GET, owner+agent): lista por
  `mediaId`.
- [x] T026 [P] [US3] Crear `src/app/api/instagram/comments/reply/route.ts` (POST, owner+agent).
- [x] T027 [P] [US3] Crear `src/app/api/instagram/comments/hide/route.ts` (POST, owner+agent):
  `action: "hide" | "delete"`.
- [x] T028 [US3] Crear `src/app/(dashboard)/instagram/comments-panel.tsx`: lista de comentarios con
  acciones responder/ocultar/borrar; integra en el shell del módulo (T021).
- [ ] T029 [US3] **Verificación de comportamiento — LIVE, PENDIENTE HUMANO**: listar, responder (aparece), ocultar
  (desaparece) en vivo. Registrar evidencia. (quickstart.md §5 paso 4 comentarios)

**Checkpoint**: US1 + US2 + US3 (conectar + publicar + moderar).

---

## Phase 6: User Story 4 - Recibir y responder mensajes directos (Priority: P2)

**Goal**: Recibir DMs por webhook (firma válida, idempotente, enrutado por `ig_user_id`) y responder en
ventana de 24 h. También recibe los eventos de `comments`.

**Independent Test**: Enviar un DM real desde otra cuenta → aparece en Inmox para el tenant correcto;
responder en <24 h llega al usuario. Camino infeliz: firma inválida (401), cuenta no mapeada (descarta),
evento repetido (no duplica), fuera de ventana (422).

### Implementation for User Story 4

- [x] T030 [US4] Crear `src/server/instagram/messaging.ts`: `listConversations(orgId)` (hilos en vivo) y
  `sendDm(orgId, recipientIgsid, text)` con chequeo de **ventana 24 h** (último entrante <24 h). Ver
  contracts §5.
- [x] T031 [US4] Crear `src/server/instagram/webhook.ts`: parseo del payload IG, **dedup por id de
  evento** (DV-IG-7), enrutado por `resolveOrgByIgUserId` (no mapeado → descarta con log), manejo de
  fields `messages` y `comments`.
- [x] T032 [US4] Crear `src/app/api/instagram/webhook/route.ts`: **GET** handshake (compara
  `hub.verify_token` con `IG_WEBHOOK_VERIFY_TOKEN` → `hub.challenge`); **POST** lee raw body, valida
  firma con `verifyWebhookSignature(raw, header, IG_APP_SECRET)` (inválida → **401**), delega a
  `webhook.ts`, responde **200**. Idempotente. Ver contracts §2.
- [x] T033 [P] [US4] Crear `src/app/api/instagram/conversations/route.ts` (GET, owner+agent): hilos DM.
- [x] T034 [P] [US4] Crear `src/app/api/instagram/messages/route.ts` (POST, owner+agent): enviar DM;
  fuera de ventana 24 h → **422** `outside_24h_window`.
- [x] T035 [US4] Crear `src/app/(dashboard)/instagram/dm-panel.tsx`: hilos + responder (deshabilita envío
  fuera de ventana 24 h); integra en el shell (T021).
- [ ] T036 [US4] **Verificación de comportamiento — LIVE, PENDIENTE HUMANO** (la firma/ventana/dedup SÍ verificadas por mí en `tests/instagram/instagram.test.ts`): recibir DM real
  enrutado al tenant correcto y responder en 24 h; firma inválida → 401; cuenta no mapeada → descarta;
  evento repetido → sin duplicado; fuera de ventana → 422. Registrar evidencia. (quickstart.md §5 paso 5
  + camino infeliz)

**Checkpoint**: US1-US4 (conectar + publicar + moderar + mensajear).

---

## Phase 7: User Story 5 - Renovación automática de tokens (Priority: P3)

**Goal**: Renovar tokens de 60 d antes de expirar; marcar `reconnect_required` si el token es inválido.

**Independent Test**: Token con `token_expires_at` <7 d → renovación lo extiende; token inválido → la
cuenta queda `reconnect_required` sin afectar a otras agencias.

### Implementation for User Story 5

- [x] T037 [US5] Crear `src/server/instagram/refresh.ts`: `refreshExpiringTokens()` recorre
  `instagram_credentials` con `status=connected` y `token_expires_at` < now+7 d, llama `refresh` (frontera
  IG), actualiza `token_expires_at`; token inválido → `markReconnectRequired`. Ver research DV-IG-6.
- [x] T038 [US5] Crear `src/app/api/cron/instagram-refresh/route.ts` (POST): auth por `CRON_SECRET`
  (header `X-Cron-Secret`; inválido → **401**); ejecuta `refreshExpiringTokens` → **200**
  `{refreshed, marked_reconnect, skipped}`.
- [x] T039 [US5] Documentar la **scheduled task diaria de Coolify** (→ `POST /api/cron/instagram-refresh`
  con `X-Cron-Secret`) en `specs/008-instagram-integration/quickstart.md` §6 / notas de deploy.
- [ ] T040 [US5] **Verificación de comportamiento — LIVE, PENDIENTE HUMANO**: simular `token_expires_at` <7 d y correr
  el endpoint → fecha extendida; simular token inválido → fila `reconnect_required`; otra agencia intacta.
  (quickstart.md §6)

**Checkpoint**: Todas las historias funcionales e independientes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Gate técnico, verificación consolidada y documentación.

- [x] T041 [P] Ejecutar el gate técnico: `pnpm typecheck && pnpm lint && pnpm build` en verde.
- [ ] T042 **Self-test E2E consolidado en vivo — PENDIENTE HUMANO** (Definición de Hecho REFORZADA): recorrer el flujo
  completo conectar→publicar(genérica+propiedad)→comentar→DM en 24 h, **más aislamiento multi-tenant**
  con dos agencias (una no ve/opera la cuenta de la otra), y el camino infeliz completo. Registrar
  transcripción/evidencia. (quickstart.md §5)
- [x] T043 [P] Documentar en README/deploy las 7 env vars y los **pasos manuales de Meta App Dashboard**
  (registrar `IG_REDIRECT_URI` sección "inicio de sesión empresarial"; webhook callback + verify token;
  app **Live**). (quickstart.md §1-2)
- [x] T044 Marcar explícitamente los **pendientes de verificación humana**: render visual del post/tarjeta
  en Instagram, aprobaciones/permisos de Meta, registro real del redirect URI y webhook en el Dashboard.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. **BLOQUEA** todas las historias.
- **US1 (Phase 3)**: depende de Foundational. Es el MVP y habilita probar US2-US5 en vivo.
- **US2 (Phase 4)**: depende de Foundational (código independiente de US1; para probar en vivo necesita
  una cuenta conectada por US1).
- **US3 (Phase 5)**, **US4 (Phase 6)**, **US5 (Phase 7)**: dependen de Foundational; código independiente
  entre sí; para ejercer en vivo requieren cuenta conectada (US1) y, US3, un post (US2).
- **Polish (Phase 8)**: depende de las historias que se quieran cerrar.

### User Story Dependencies (código)

- US1 → solo Foundational.
- US2 → solo Foundational (+ US1 para test en vivo).
- US3 → solo Foundational (+ US1, US2 para test en vivo).
- US4 → solo Foundational (+ US1 para test en vivo).
- US5 → solo Foundational (+ US1 para test en vivo).

### Within Each User Story

- Servicios (`src/server/instagram/*`) antes de las rutas (`src/app/api/instagram/*`).
- Rutas antes de la UI que las consume.
- La tarea de **verificación de comportamiento** cierra cada historia.

### Parallel Opportunities

- T004 y T005 (Foundational) en paralelo (frontera vs credenciales, archivos distintos).
- US1: T009 y T010 en paralelo. US2: T014, T015, T017, T020 en paralelo. US3: T025-T027 en paralelo.
  US4: T033 y T034 en paralelo.
- Tras Foundational, US2-US5 pueden desarrollarse en paralelo (archivos distintos); US1 primero por ser
  el habilitador de pruebas en vivo.

---

## Parallel Example: Foundational

```text
# Tras el esquema+migración (T002, T003), lanzar en paralelo:
Task T004: Frontera de transporte src/lib/instagram/index.ts
Task T005: Módulo de credenciales src/server/instagram/credentials.ts
```

## Parallel Example: User Story 2

```text
Task T014: getObjectStream en src/lib/storage/index.ts
Task T015: src/lib/instagram/media-token.ts
Task T017: src/lib/instagram/schemas.ts (Zod publish)
Task T020: src/components/instagram/property-picker.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 (Setup) → Phase 2 (Foundational, CRÍTICA).
2. Phase 3 (US1 Conectar) → **validar en vivo** (T013).
3. Phase 4 (US2 Publicar) → **validar en vivo** (T023).
4. Con conectar + publicar el canal ya entrega valor demostrable (difundir inventario).

### Incremental Delivery

US1 → US2 → US3 → US4 → US5, validando cada historia en vivo en su checkpoint antes de avanzar; cada una
suma sin romper las anteriores.

### Definición de Hecho

Cada historia: typecheck+lint+build verde **+ su self-test de comportamiento**. Cierre de feature: T041
(gate) + T042 (E2E consolidado + aislamiento multi-tenant + camino infeliz) verdes y conducidos por
Claude; lo no verificable (render visual, Meta) marcado como pendiente humano (T044).

---

## Estado de implementación (2026-06-23)

- **Código: COMPLETO** (T001–T012, T014–T022, T024–T028, T030–T035, T037–T039, T041, T043–T044).
- **Gate técnico VERDE**: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm build` ✅.
- **Self-test de lógica verificable VERDE**: `tests/instagram/instagram.test.ts` (23 casos) cubre token del
  proxy de media, `state` OAuth (válido/manipulado/expirado/basura), ventana de 24 h, caption determinista,
  firma de webhook con `IG_APP_SECRET` y validación Zod. `pnpm test` → 33/33.
- **PENDIENTE DE VERIFICACIÓN HUMANA** (no simulable sin un usuario externo de IG ni cuentas reales de Meta —
  ver [[project-instagram-integration]]): T013, T023, T029, T036, T040, T042. Requieren: registrar
  `IG_REDIRECT_URI` + webhook en el App Dashboard (app Live), conectar la cuenta de prueba por OAuth,
  publicar una imagen real, recibir/responder un DM y un comentario reales. Guion en quickstart.md §5.
- **F1 del analyze resuelto**: se añadió la tabla `instagram_dm` (log mínimo) para dar efecto observable al
  DM entrante, soportar la ventana de 24 h y garantizar idempotencia (`ig_message_id` UNIQUE). Ver data-model.

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes.
- Sin tareas de test-files (TDD) por decisión del proyecto: la verificación es el self-test E2E de
  comportamiento (memoria `feedback-self-test-after-implement`).
- No se toca `src/lib/meta`, el agente IA ni la bandeja de WhatsApp (IG aislado en Fase 1).
- Commit tras cada tarea o grupo lógico; merge a `main` solo con OK explícito del dueño.
