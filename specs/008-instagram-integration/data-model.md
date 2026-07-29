# Data Model — Integración de Instagram (Fase 1)

Migración **aditiva** (no destructiva): 1 enum nuevo + 2 tablas nuevas. No se modifica ninguna tabla
existente. Convenciones del proyecto: IDs `text` con prefijo (nanoid), `organization_id` indexado en
toda tabla de dominio, timestamps `created_at`/`updated_at`.

## Enum nuevo

### `ig_connection_status`

```
connected | disconnected | expired | reconnect_required
```

Separado del enum de WhatsApp (`connectionStatus` = connected|disconnected|expired) para no mutarlo y
para añadir `reconnect_required` (token inválido / refresh fallido).

---

## Tabla `instagram_credentials`

Conexión 1:1 de una agencia con su cuenta de IG. Espejo de `meta_credentials` pero con campos de IG.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | prefijo `igc_` |
| `organization_id` | text NOT NULL FK→organization (cascade) | **UNIQUE** (1:1 por tenant) |
| `ig_user_id` | text NOT NULL | **UNIQUE** — id de la cuenta de IG; llave de enrutado de webhooks |
| `username` | text NOT NULL | `@usuario` mostrado en Configuración |
| `encrypted_token` | text NOT NULL | token largo (60 d) cifrado AES-256-GCM (base64) |
| `token_iv` | text NOT NULL | IV del cifrado (base64) |
| `auth_tag` | text NOT NULL | auth tag GCM (base64) |
| `token_expires_at` | timestamp NOT NULL | para el cron de refresh (umbral <7 d) |
| `status` | `ig_connection_status` NOT NULL default `connected` | |
| `connected_at` | timestamp | |
| `updated_at` | timestamp NOT NULL default now | |

**Índices**: `uniqueIndex(organization_id)`, `uniqueIndex(ig_user_id)`.

**Reglas**:
- Cifrado vía `seal()`/`open()` de `src/lib/crypto` (mismo patrón que WhatsApp).
- El token **nunca** se devuelve al cliente; `getConnectionStatus(orgId)` retorna solo
  `{ status, username, ig_user_id, token_expires_at }` (sin token).
- Desconectar = `DELETE` de la fila (o `status=disconnected` + limpieza; se elige DELETE para no dejar
  token cifrado huérfano — decisión menor en implementación).

---

## Tabla `instagram_post`

Registro **local** de las publicaciones creadas desde Inmox. Permite trazar qué propiedad se publicó,
listar comentarios por `ig_media_id`, y deduplicar/relacionar eventos de webhook de comentarios.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | prefijo `igp_` |
| `organization_id` | text NOT NULL FK→organization (cascade) | scope de tenant |
| `ig_media_id` | text NOT NULL | **UNIQUE** — id del post real en Instagram |
| `property_id` | text FK→property (set null) | nullable: null = compositor genérico |
| `caption` | text | caption usado al publicar |
| `media_type` | text NOT NULL default `IMAGE` | IMAGE (Fase 1) · REELS/CAROUSEL preparado |
| `created_by` | text FK→user | quién publicó |
| `created_at` | timestamp NOT NULL default now | |

**Índices**: `uniqueIndex(ig_media_id)`, `index(organization_id)`.

**Reglas**:
- Se inserta tras `media_publish` exitoso (cuando ya hay `ig_media_id`).
- Borrar una propiedad → `property_id` queda null (el post de IG sobrevive; set null), no se borra el
  registro histórico.

---

## Tabla `instagram_dm` (resuelve F1 del analyze)

Log mínimo de mensajes directos del módulo IG (NO es la bandeja unificada de WhatsApp; sigue aislado).
Decisión tomada en US4: para que un DM entrante tenga **efecto observable** (FR-018), se pueda calcular
la **ventana de 24 h** (FR-020) y el webhook sea **idempotente** (FR-023), se persiste un registro
mínimo. La lectura de hilos completa sigue siendo en vivo contra Graph (FR-019).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | prefijo `igdm_` |
| `organization_id` | text NOT NULL FK→organization (cascade) | scope de tenant |
| `counterparty_igsid` | text NOT NULL | el usuario de IG (remitente entrante / destinatario saliente) |
| `direction` | `message_direction` NOT NULL | reusa el enum existente (`inbound`/`outbound`) |
| `text` | text | contenido (puede ser null) |
| `ig_message_id` | text | `mid` de IG; **UNIQUE** → dedup de reintentos del webhook (nulls múltiples permitidos para salientes) |
| `created_at` | timestamp NOT NULL default now | usado como referencia de la ventana de 24 h |

**Índices**: `uniqueIndex(ig_message_id)`, `index(organization_id, counterparty_igsid)`.

**Reglas**:
- Entrante: `INSERT … onConflictDoNothing(ig_message_id)` (idempotente). Echos (`is_echo`) se ignoran.
- Ventana 24 h: `lastInboundAt(org, counterparty)` = `max(created_at)` de los `inbound`; se compara con
  `isWithinWindow()` (lógica pura, testeada).

## Idempotencia de webhook (DV-IG-7)

Fase 1 no archiva DMs ni comentarios en una bandeja persistente; las lecturas (hilos, comentarios) son
**en vivo** contra Graph. Por tanto:

- **Comentarios entrantes**: el efecto observable que podría duplicarse es cualquier acción derivada;
  como en Fase 1 no se persiste el comentario ni se dispara acción automática (operación manual), no hay
  duplicado observable. Si en implementación se decide registrar comentarios, la tabla llevará
  `ig_comment_id` UNIQUE con `ON CONFLICT DO NOTHING`.
- **Mensajes entrantes (DM)**: ídem; si se persiste un log de DM entrante para mostrarlo, la tabla
  llevará `ig_message_id` (`mid`) UNIQUE con `ON CONFLICT DO NOTHING` (patrón de `wa_message_id`).
- **Decisión Fase 1**: dado el alcance "aislado / lectura en vivo", el webhook valida firma, enruta por
  `ig_user_id` y entrega el evento a la UI/notificación sin persistir efecto duplicable. Si la
  implementación introduce persistencia de DM/comentario, **debe** añadir la columna UNIQUE
  correspondiente (queda registrado aquí como requisito condicional para no romper Principio IV).

---

## Estado / transiciones de `status` en `instagram_credentials`

```
(sin fila)
   │ connect OK (callback)
   ▼
connected ──────refresh OK───────► connected (token_expires_at extendido)
   │  │
   │  └── refresh falla (token inválido) ──► reconnect_required
   │
   ├── token vence sin refresh ──► expired
   │
   └── disconnect (owner) ──► (fila eliminada)
```

`reconnect_required` y `expired` → la tarjeta de Configuración invita a **Reconectar** (re-OAuth).

---

## Relación con entidades existentes

- **`property` / `property_photo`** (007): lectura para "Publicar propiedad" (foto principal = menor
  `sort_order`; campos para el caption). Sin cambios de schema.
- **`organization` / `member` / `user`**: scope de tenant y rol (owner conecta/desconecta;
  owner+agent publican/moderan/mensajean).
- **`meta_credentials`** (WhatsApp): **intacta**; IG no la toca.
