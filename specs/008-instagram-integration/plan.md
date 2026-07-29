# Implementation Plan: Integración de Instagram (Fase 1)

**Branch**: `008-instagram-integration` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-instagram-integration/spec.md`

## Summary

Añadir **Instagram como segundo canal** de Inmox usando **"Instagram API con Instagram Login"** (host
`graph.instagram.com`, sin Facebook Login ni Página de Facebook). Cada agencia (tenant) conecta su
cuenta IG Business/Creator vía OAuth (Business Login for Instagram) y desde Inmox puede **publicar**
(compositor genérico + "Publicar propiedad" reusando fotos R2 de 007), **moderar comentarios** y
**mensajear por DM** (recibir por webhook + responder en ventana 24 h). En esta fase IG es un **módulo
aislado**: NO entra a la bandeja unificada ni lo opera el agente IA. Se crea una **frontera nueva
`src/lib/instagram`** (espejo de `lib/meta` pero contra `graph.instagram.com`, tokens por-tenant y
firma con `IG_APP_SECRET`), tabla nueva **`instagram_credentials`** (1:1 por tenant, cifrada), una
**ruta proxy pública de media** para que Meta descargue la imagen a publicar, y un **endpoint de cron**
protegido para renovar tokens de 60 días. Se reutilizan tal cual: `src/lib/crypto` (`seal`/`open`),
`verifyWebhookSignature` (acepta `secret`), `src/lib/storage` (+ un getter de stream nuevo), el guard
multi-tenant (`getActiveContext`/`requireOwner`) y, para "Publicar propiedad", `property` +
`property_photo` de 007.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Next.js 15 App Router

**Primary Dependencies**: Drizzle ORM + PostgreSQL · Better Auth (plugin `organization`, roles
owner/agent) · Zod en todo input externo · AWS SDK S3 (`@aws-sdk/client-s3` + `s3-request-presigner`,
R2) · `node:crypto` (HMAC firma webhook, AES-256-GCM, HMAC token de proxy/state) · Tailwind +
shadcn/ui · lucide-react. **Sin SDK nuevo de Meta**: todo contra `graph.instagram.com` por `fetch`.

**Storage**: PostgreSQL — tabla nueva `instagram_credentials`; tabla nueva `instagram_post` (registro
local de publicaciones creadas desde Inmox, para trazar propiedad de origen y enrutar comentarios).
Objetos en R2 vía `src/lib/storage` (interfaz S3). Estado OAuth `state` y dedup de webhook: ver
research (DV-IG-7 dedup, DV-IG-2 state).

**Testing**: typecheck (`pnpm typecheck`) + lint (`pnpm lint`) + build (`pnpm build`) **+ self-test
de comportamiento E2E en vivo** (Definición de Hecho REFORZADA): conectar cuenta IG de prueba →
publicar imagen real (genérica y desde propiedad) → listar/responder/ocultar comentario → recibir y
responder DM real en ventana 24 h; **camino infeliz**: firma de webhook inválida (rechaza), token
expirado (marca `reconnect_required`), propiedad sin foto (bloquea), ventana 24 h vencida (bloquea sin
colgarse), evento de webhook repetido (no duplica).

**Target Platform**: App web SSR en Coolify (app + Postgres separados; migración aditiva por
arranque/Pre-Deployment). Webhook y proxy de media deben ser alcanzables públicamente por Meta; app
**Live** en Meta App Dashboard.

**Project Type**: Web application (monolito Next.js: `src/app`, `src/components`, `src/lib`, `src/server`)

**Performance Goals**: Operación manual de una agencia chica (2–10 usuarios). Publicar = 2 pasos
síncronos (crear contenedor → publicar) con feedback claro. Webhook responde rápido y procesa
idempotente. Renovación de tokens en lote diario.

**Constraints**: Multi-tenant estricto (toda query con `organization_id`); tokens/secretos **nunca** al
cliente ni a logs; secreto del producto IG (`IG_APP_SECRET`) **distinto** del de WhatsApp
(`META_APP_SECRET`); acceso a objetos solo vía interfaz S3 estándar; migración aditiva no destructiva;
integración externa aislada tras frontera (`src/lib/instagram`, sin tocar `src/lib/meta`).

**Scale/Scope**: 1 frontera nueva (`src/lib/instagram`), 2 tablas nuevas (`instagram_credentials`,
`instagram_post`) + 1 enum nuevo (`ig_connection_status`), ~11 rutas nuevas (`/api/instagram/*`,
`/api/public/media/[...]`, `/api/cron/instagram-refresh`), 1 página de settings + tarjeta espejo, UI de
publicar/comentarios/DM, 7 variables de entorno nuevas. Sin tocar WhatsApp/agente/bandeja.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en esta feature |
|---|---|
| **I. Seguridad de datos** | Token de IG cifrado at-rest (`seal`/`open`, AES-256-GCM) igual que WhatsApp; nunca al cliente ni a logs. La ruta proxy de media valida un **token firmado (HMAC) por objeto** y solo sirve esa key (no lista ni filtra otros objetos del tenant). `state` anti-CSRF firmado en el OAuth. Firma de webhook validada con `IG_APP_SECRET`. |
| **II. Soberanía / Self-Hosted** | Auth + Postgres self-hosted intactos. Objetos solo vía `src/lib/storage` (interfaz S3, portable a MinIO). IG es integración externa **inevitable** → aislada tras frontera dedicada `src/lib/instagram` (Principio II, "integraciones aisladas"). Sin APIs propietarias no-S3. |
| **III. Multi-Tenancy real** | `organization_id` parámetro de primer nivel en `instagram_credentials` (UNIQUE 1:1) y `instagram_post`; todo endpoint pasa por `getActiveContext()`/`requireOwner()`. El webhook enruta por `ig_user_id` (UNIQUE) → tenant; evento de cuenta no mapeada se descarta. |
| **IV. Idempotencia** | Webhook de IG idempotente por id de evento/mensaje (dedup, ver DV-IG-7). Suscripción `subscribed_apps` idempotente en Meta. Publicar NO es entrante (acción del usuario); aun así se evita doble publicación por estado de UI. |
| **V. Calidad verificable** | "Hecho" = typecheck+lint+build **+ self-test E2E en vivo**; lo no verificable (render visual del post en IG, aprobaciones de Meta) se marca pendiente humano. |
| **VI. Specs antes de código** | spec.md redactada y validada (16/16); este plan deriva de ella; implementación tras `/speckit-tasks`. |
| **VII. Trazabilidad** | Decisiones DV-IG-1…DV-IG-9 en research.md; supuestos en spec.md (Assumptions); pasos manuales de Meta en quickstart.md. |
| **VIII. Foco inmobiliario** | El canal sirve a la agencia para difundir su **inventario** (modo "Publicar propiedad" reusa `property`+`property_photo` de 007) y atender prospectos por DM/comentarios. No genera contratos. WhatsApp sigue siendo canal principal; IG lo complementa. |

**Resultado**: PASA. Sin violaciones → Complexity Tracking vacío. (La frontera nueva y las 2 tablas no
son complejidad injustificada: son la forma constitucional de aislar una integración externa y de no
contaminar la tabla WhatsApp-only `meta_credentials`.)

## Project Structure

### Documentation (this feature)

```text
specs/008-instagram-integration/
├── plan.md              # Este archivo
├── research.md          # Fase 0 (decisiones DV-IG-1…9)
├── data-model.md        # Fase 1 (instagram_credentials, instagram_post, enum, dedup)
├── quickstart.md        # Fase 1 (env vars + pasos manuales Meta + guion self-test)
├── contracts/
│   └── instagram-api.md # Fase 1 (contratos de los ~11 endpoints)
├── checklists/
│   └── requirements.md  # Calidad de la spec (16/16)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (dashboard)/
│   │   ├── settings/
│   │   │   ├── page.tsx                       # MOD: añadir tarjeta "Instagram" (espejo de WhatsApp)
│   │   │   └── instagram/page.tsx             # NUEVO: estado conexión + Conectar/Desconectar (owner)
│   │   └── instagram/                         # NUEVO: módulo IG (aislado de la bandeja)
│   │       ├── page.tsx                       # NUEVO: shell (publicar · comentarios · DMs)
│   │       ├── composer.tsx                   # NUEVO: compositor (subir imagen / desde propiedad)
│   │       ├── comments-panel.tsx             # NUEVO: listar/responder/ocultar comentarios
│   │       └── dm-panel.tsx                    # NUEVO: hilos DM + responder (ventana 24 h)
│   └── api/
│       ├── instagram/
│       │   ├── connect/route.ts              # NUEVO: GET inicia OAuth (state firmado) → redirect
│       │   ├── callback/route.ts             # NUEVO: GET valida state → token largo → guarda → subscribe
│       │   ├── disconnect/route.ts           # NUEVO: POST elimina credencial (owner)
│       │   ├── webhook/route.ts              # NUEVO: GET handshake · POST firma+idempotencia+ruteo
│       │   ├── publish/route.ts              # NUEVO: POST publicar (genérico | desde propiedad)
│       │   ├── comments/route.ts             # NUEVO: GET listar (por media id)
│       │   ├── comments/reply/route.ts       # NUEVO: POST responder
│       │   ├── comments/hide/route.ts        # NUEVO: POST ocultar/borrar
│       │   ├── conversations/route.ts        # NUEVO: GET hilos DM
│       │   └── messages/route.ts             # NUEVO: POST enviar DM (ventana 24 h)
│       ├── public/media/[...key]/route.ts    # NUEVO: proxy público de objeto (token firmado)
│       └── cron/instagram-refresh/route.ts   # NUEVO: POST renovar tokens (protegido por CRON_SECRET)
├── server/
│   └── instagram/
│       ├── credentials.ts                    # NUEVO: get/save/delete + getConnectionStatus (scoped, cifra)
│       ├── oauth.ts                          # NUEVO: signState/verifyState, exchangeCode, exchangeLong, refresh
│       ├── publish.ts                        # NUEVO: createMediaContainer + publish (+ captionFromProperty)
│       ├── comments.ts                       # NUEVO: list/reply/hide/delete (token del tenant)
│       ├── messaging.ts                      # NUEVO: listConversations/sendDm + ventana 24 h
│       ├── webhook.ts                        # NUEVO: parse + dedup + ruteo por ig_user_id
│       └── refresh.ts                        # NUEVO: renovar tokens próximos a expirar (lote)
├── lib/
│   ├── instagram/
│   │   ├── index.ts                          # NUEVO: frontera Graph IG (igGraphRequest, builders, tipos)
│   │   └── media-token.ts                    # NUEVO: sign/verify token del proxy de media (HMAC)
│   ├── storage/index.ts                      # MOD: + getObjectStream(key) para el proxy
│   ├── meta/index.ts                         # SIN CAMBIOS (reuso de verifyWebhookSignature vía import)
│   ├── crypto/index.ts                       # SIN CAMBIOS (reuso seal/open)
│   ├── db/schema/domain.ts                   # MOD: igConnectionStatus enum + instagram_credentials + instagram_post
│   └── env.ts                                # MOD: + IG_APP_ID/SECRET/REDIRECT_URI/WEBHOOK_VERIFY_TOKEN/GRAPH_VERSION, MEDIA_PROXY_SIGNING_SECRET, CRON_SECRET
├── components/instagram/
│   ├── instagram-connect-card.tsx            # NUEVO: tarjeta de conexión (Conectar/Desconectar)
│   └── property-picker.tsx                   # NUEVO: selector de propiedad para "Publicar propiedad"
└── ...

drizzle/                                       # NUEVO: migración aditiva (enum + 2 tablas)
```

**Structure Decision**: Monolito Next.js existente. **Frontera nueva `src/lib/instagram`** porque
`src/lib/meta` está clavado a `graph.facebook.com`, default-token del System User de WhatsApp y semántica
WhatsApp; mezclarlo violaría el aislamiento (Principio II) y arriesgaría el canal en producción. El
dominio IG vive en `src/server/instagram/*` (servicios scoped por tenant que descifran el token del
tenant y llaman a la frontera). El módulo IG de UI vive bajo `(dashboard)/instagram` **separado de la
bandeja** (decisión del dueño: aislado en Fase 1). La ruta proxy `/api/public/media/[...key]` es
**deliberadamente pública** (sin sesión) porque los servidores de Meta la consumen; su seguridad es un
**token HMAC por objeto** con expiración media. Validación Zod compartida cliente/servidor.

## Complexity Tracking

> Sin violaciones constitucionales. No aplica.
