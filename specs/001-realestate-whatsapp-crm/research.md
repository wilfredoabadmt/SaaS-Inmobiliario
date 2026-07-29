# Phase 0 — Research & Decisions

**Feature**: CRM Inmobiliario con WhatsApp · **Branch**: `001-realestate-whatsapp-crm`
· **Date**: 2026-06-07

El stack fue fijado por el usuario en la entrada de `/speckit-plan`; esta fase
documenta **cómo** se aplican esas elecciones, las alternativas descartadas y las
decisiones tomadas sin certeza que requieren revisión humana (Principio VII).

---

## D1 — Multi-tenancy (Better Auth `organization` + Drizzle)

- **Decision**: Cada **agencia = `organization`** de Better Auth. Los usuarios son
  `member` con rol `owner` o `agent`. Toda tabla de dominio lleva `organization_id`
  (FK → `organization.id`, indexado). El acceso a datos pasa por un helper
  `withTenant(orgId)` que inyecta el filtro `eq(table.organizationId, orgId)` en
  toda consulta; ninguna query de dominio se construye sin scope de tenant.
- **Rationale**: cumple el Principio III (multi-tenancy real) y IV de aislamiento
  con un modelo shared-database/shared-schema simple de operar en un VPS. El plugin
  `organization` ya provee invitaciones y roles (cubre FR-008/FR-009).
- **Alternatives considered**: (a) schema-per-tenant en Postgres — más aislamiento
  pero migraciones y conexiones mucho más costosas para un MVP; (b) database-per-tenant
  — descartado por sobrecarga operativa en VPS de bajos recursos.

## D2 — WhatsApp Cloud API como Tech Provider propio + Embedded Signup

- **Decision**: Onboarding mediante **Embedded Signup** (Facebook Login for Business)
  usando `META_CONFIG_ID` y `META_APP_ID` en el cliente; el intercambio de código y
  el registro del número se hacen server-side con `META_APP_SECRET` y
  `META_SYSTEM_USER_TOKEN`. El cliente de Cloud API vive en `src/lib/meta` y en esta
  fase solo expone **transporte tipado + tipos** (no endpoints de negocio).
- **Rationale**: cumple FR-001 (conectar sin escribir código). Centralizar Meta en
  `lib/meta` respeta el Principio II (aislar integraciones externas tras una
  frontera).
- **Env vars requeridas** (solo nombres, nunca valores): `META_APP_ID`,
  `META_APP_SECRET`, `META_CONFIG_ID`, `META_SYSTEM_USER_TOKEN`,
  `META_SOLUTION_PARTNER_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_API_VERSION`.
- **Alternatives considered**: BSP de terceros (Twilio/360dialog) — descartado:
  añade dependencia SaaS no soberana y costo por mensaje; el usuario es Tech Provider
  propio.

## D3 — Idempotencia y verificación de webhooks

- **Decision**: El endpoint `POST /api/webhooks/whatsapp` (1) **verifica la firma**
  `X-Hub-Signature-256` (HMAC-SHA256 del raw body con `META_APP_SECRET`) **antes** de
  parsear/procesar; (2) **deduplica por `message id`** de WhatsApp mediante una
  columna `wa_message_id` con **UNIQUE constraint** — un insert duplicado se ignora
  (ON CONFLICT DO NOTHING). `GET` responde el challenge con `META_WEBHOOK_VERIFY_TOKEN`.
- **Rationale**: cumple Principio IV y FR-005/SC-003. La firma protege contra
  eventos no auténticos (Principio I).
- **Alternatives considered**: dedup en memoria/cache — descartado por no sobrevivir
  reinicios; la unicidad a nivel DB es la garantía durable.

## D4 — Cifrado del token de Meta en reposo (AES-256-GCM)

- **Decision**: El token de acceso del número se guarda en `meta_credentials` como
  `encrypted_token` + `token_iv` (nonce de 12 bytes) + `auth_tag`, cifrado con
  **AES-256-GCM** usando una clave maestra en env var (`ENCRYPTION_KEY`, 32 bytes
  base64). Helpers en `src/lib/crypto`. El token se descifra solo en memoria del
  servidor al llamar a Meta; nunca se serializa al cliente ni se registra.
- **Rationale**: cumple Principio I y FR-006/SC-008.
- **Alternatives considered**: pgcrypto en DB — descartado para no exponer la clave
  a la base; KMS gestionado — descartado por soberanía (Principio II) en el MVP.

## D5 — Abstracción de almacenamiento de objetos (S3 estándar, portable)

- **Decision**: `src/lib/storage` envuelve `@aws-sdk/client-s3` y expone
  `putObject`, `getSignedUrl` (subida/descarga con URLs prefirmadas) y `deleteObject`.
  Endpoint, región, bucket y credenciales vienen de env vars
  (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_FORCE_PATH_STYLE`). Proveedor MVP: **Cloudflare R2**. No se usan APIs
  propietarias no-S3.
- **Rationale**: cumple el Principio II v1.2.0 — migrar a **MinIO** self-hosted solo
  cambia variables de entorno, sin tocar código. Las fotos (≤20, ≤10 MB, JPG/PNG/WebP,
  FR-013) y documentos/contratos (FR-019/FR-020/FR-023) se suben directo a S3 con URL
  prefirmada; la DB guarda solo la `storage_key`.
- **Alternatives considered**: guardar binarios en Postgres — descartado (satura DB
  y backups del VPS, justamente lo que motivó la excepción del Principio II).

## D6 — Estrategia de IDs (nanoid con prefijo)

- **Decision**: PK `text` generada con nanoid y prefijo por entidad: `org_`, `usr_`,
  `prop_`, `photo_`, `cli_`, `cand_`, `conv_`, `msg_`, `tmpl_`, `show_`, `doc_`,
  `ctr_`, `wamc_` (meta_credentials). Las tablas de Better Auth conservan sus IDs.
- **Rationale**: IDs legibles y autodescriptivos en logs/depuración; evitan colisión
  semántica entre entidades. Sin exponer conteos (a diferencia de IDs secuenciales).

## D7 — Actualización en vivo de la bandeja (P1) — RESUELTA (DV-1)

- **Decision**: la bandeja usa **polling ligero** en el MVP, pero **encapsulado tras
  una única abstracción** de transporte de tiempo real (p. ej. un hook
  `useRealtimeMessages` / módulo `src/lib/realtime`). El resto de la app **no** sabe
  si por dentro es polling o websocket: consume solo esa frontera.
- **Rationale**: cumple SC-002/003 (< 2 s) sin infraestructura de websockets en un VPS
  de bajos recursos, y permite **migrar a websocket en v1.1 cambiando solo esa pieza**,
  sin tocar los componentes consumidores. **No** se implementa websocket ahora; solo
  se deja la frontera bien definida.
- **Alternatives considered**: websocket/SSE desde el MVP — descartado por costo
  operativo prematuro; acoplar polling directo en los componentes — descartado por
  bloquear la migración futura.

## D8 — Recordatorios de muestras (P3) — RESUELTA (DV-2)

- **Decision**: las muestras (`showing`) almacenan `remind_at`; un proceso programado
  (cron) revisa periódicamente las muestras próximas (`status = agendada` y
  `now() ≥ remind_at`) y **emite el recordatorio por WhatsApp usando una plantilla
  aprobada** dirigida al agente responsable. Default: 24 h y 1 h antes (Assumption del
  spec).
- **Rationale**: el canal WhatsApp es coherente con el producto (es el canal
  principal) y reutiliza la integración ya existente (`lib/meta`) y el catálogo de
  plantillas. El destinatario es el agente responsable de la muestra.
- **Alternatives considered**: notificación in-app — descartada como canal único
  (el agente puede no tener la app abierta); email — fuera del foco del producto.

## D9 — Testing y gates de calidad

- **Decision**: gates **obligatorios** = `tsc --noEmit` (estricto), ESLint y
  `next build`. **Vitest** para unidad/integración (capa de datos con scope de tenant,
  crypto, idempotencia del webhook, validación Zod). **Playwright** para E2E de un
  flujo crítico por historia (P1 enviar/recibir; P2 alta de propiedad + vínculo;
  P3 invitar agente + agendar; P4 subir documento + estado de contrato).
- **Rationale**: Principio V; los tests se concentran donde hay riesgo real
  (aislamiento, idempotencia, seguridad).

## D10 — Despliegue en Coolify

- **Decision**: imagen **Docker multi-stage** con salida Next `standalone`. App y
  **PostgreSQL** como **servicios separados** del mismo proyecto Coolify, conectados
  por red interna vía `DATABASE_URL`. **Migraciones** (`pnpm db:migrate`) se ejecutan
  como **Pre-Deployment Command** de Coolify, **nunca** en `docker build`.
  **Healthcheck** en `GET /api/health` (verifica conexión a DB).
- **Rationale**: separar migración del build evita imágenes no reproducibles y
  migraciones accidentales; el healthcheck da readiness real.

## D11 — Fidelidad visual (referencias en `docs/design/`) — RESUELTA (DV-3)

- **Decision**: Reimplementar **nativo** en Next 15 + shadcn/ui replicando las
  decisiones visuales de los HTML de referencia: bandeja en **layout de 3 columnas**
  (lista de conversaciones · hilo de mensajes · panel lateral propiedad+candidato);
  catálogo en **grid de tarjetas**; acento **ámbar para renta**, **teal para venta**.
  **No** se mergea el HTML.
- **Tokens extraídos** (del `:root` y estilos embebidos en los bundles): tipografía
  **Geist** (pesos 400–700, incluidos 550/650/680); paleta teal `--accent #0d9488`,
  `#0f766e`, `#ccfbf1`, `#f0fdfa`, `#115e59`; paleta ámbar (renta) `#d99a08`/`#c2790a`,
  texto `#9a5b00`, tint `#fff8ed`/`#fffbeb`, borde `#fce8c8`/`#fde6c4`; radios
  `--radius-sm 7px / --radius 10px / --radius-lg 14px`; densidad `--row-py 11px`.
  Detalle completo en [design-tokens.md](./design-tokens.md).
- **Rationale**: los archivos `(offline).html` son exports empaquetados, pero el
  `<script type="__bundler/template">` contiene el `:root` legible; los tokens se
  **leyeron** de ahí (no se inventaron). Mapear a tokens de Tailwind/shadcn.

---

## Decisiones resueltas por verificación humana (Principio VII)

> Todas se resolvieron con el usuario el **2026-06-07**. Se mantienen registradas
> (no enterradas en el código).

- **DV-1 (bandeja en vivo, D7)** — ✅ RESUELTA: **polling** en el MVP **detrás de una
  única abstracción** de transporte (hook/módulo de tiempo real); el resto de la app
  es agnóstico. No se implementa websocket ahora; la frontera queda lista para migrar
  en v1.1 cambiando solo esa pieza.
- **DV-2 (recordatorios, D8)** — ✅ RESUELTA: el recordatorio de muestra se envía **por
  WhatsApp con plantilla aprobada** al agente responsable.
- **DV-3 (tokens de diseño, D11)** — ✅ RESUELTA: tokens **extraídos** de
  `docs/design/` (Geist; paletas teal/ámbar; radios; densidad) → ver
  [design-tokens.md](./design-tokens.md). No se inventaron valores.
- **DV-4 (modelo cliente↔conversación)** — ✅ RESUELTA: se **mantiene el modelo rico**:
  un `client` puede tener **varias** conversaciones (1:N); una conversación se asocia a
  varias propiedades (M:N) con una marcada como principal. **No** se simplifica.
- **DV-5 (estado "Documentación" del pipeline)** — ✅ RESUELTA: es **manual**; lo marca
  el agente cuando solicita documentos al candidato. **No** es automático al subir
  archivos.

**Output**: todas las incógnitas de Technical Context resueltas. Listo para Fase 1 /
`/speckit-tasks`.
