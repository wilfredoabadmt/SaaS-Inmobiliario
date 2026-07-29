# Data Model — 009 Gestión de contactos vinculada a la bandeja

Cambio de datos **mínimo y aditivo**: 1 columna nueva en `client`. El resto es reuso de tablas existentes
(`conversation`, `message`, `template`). Migración no destructiva (constitución V).

## Entidad modificada: `client`

Tabla existente (`src/lib/db/schema/domain.ts`). Se añade **una** columna.

| Columna | Tipo | Notas |
|---|---|---|
| id | text PK | existente (`newId("client")`) |
| organization_id | text FK→organization | existente; scope de tenant (cascade) |
| name | text NULL | existente; opcional (perfil WhatsApp o manual) |
| phone | text NOT NULL | existente; identidad de mensajería |
| email | text NULL | existente; opcional |
| notes | text NULL | existente; opcional |
| **channel** | **text NOT NULL DEFAULT `'whatsapp'`** | **NUEVO**: canal de origen. Valores: `whatsapp \| instagram \| messenger \| manual` |
| created_at | timestamp | existente |
| updated_at | timestamp | existente |

Índices: se conserva `client_org_phone_uq (organization_id, phone)` (UNIQUE) — es la llave de dedup y de
unicidad por tenant. No se requiere índice nuevo para `channel` (se filtra/lee junto al scope de org); se
deja como **opcional** un `index(organization_id, channel)` si el filtrado por canal en la lista lo pide.

### Definición Drizzle (objetivo)

```ts
export const client = pgTable(
  "client",
  {
    id: text("id").primaryKey(),
    organizationId: orgFk(),
    name: text("name"),
    phone: text("phone").notNull(),
    email: text("email"),
    notes: text("notes"),
    // 009: canal de origen del contacto. `text` (no enum) para extensibilidad
    // WhatsApp→Instagram/Messenger sin ALTER TYPE. Ver research DV-CM-1.
    channel: text("channel").notNull().default("whatsapp"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("client_org_phone_uq").on(t.organizationId, t.phone)],
);
```

### Migración (aditiva)

```sql
ALTER TABLE "client" ADD COLUMN "channel" text NOT NULL DEFAULT 'whatsapp';
```

- El `DEFAULT 'whatsapp'` **backfilea** todos los contactos existentes a `whatsapp` (todos provienen de un
  inbound de WhatsApp). Correcto y sin pérdida.
- Se genera con el flujo de migraciones del proyecto (drizzle-kit) y se aplica por **Pre-Deployment
  Command** en Coolify (ver memoria de deploy). No destructiva.

## Tipo de dominio `Channel`

`src/lib/clients/types.ts`:

```ts
export const CHANNELS = ["whatsapp", "instagram", "messenger", "manual"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface ClientListItem {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  channel: Channel;
  lastActivityAt: string | null;   // de la conversación más reciente; null si no tiene
  conversationId: string | null;   // conversación más reciente si existe (deep-link directo)
}
```

`channel` se trata como `Channel` en TS; valores fuera del set se renderizan como `manual` (degradación
defensiva, sin romper la UI).

## Reglas de comportamiento sobre los datos

### Creación manual (FR-002)

- Inserta con `channel = 'manual'`, `name`/`email`/`notes` opcionales, `phone` requerido.
- Unicidad: si `(organization_id, phone)` ya existe → **409** (no crea duplicado). Ver contratos.

### Edición (FR-003 / FR-004 / DV-CM-7)

- `name`, `email`, `notes` editables libremente.
- `phone` editable; al cambiar, validar unicidad por org (precheck + índice único como red de seguridad)
  → choque = **409**.
- `channel` **no** es editable por el usuario (es derivado del sistema).

### Auto-alta + enriquecimiento desde inbound (FR-006…FR-011 / DV-CM-4)

En `ingest.ts`, al llegar un inbound de WhatsApp con `phone` y `profileName`:

```
INSERT client (id, org, phone, name=profileName, channel='whatsapp')
ON CONFLICT (org, phone) DO UPDATE SET
  name    = COALESCE(client.name, EXCLUDED.name),     -- completa si estaba vacío; no pisa lo editado
  channel = CASE WHEN client.channel = 'manual'        -- "canal de origen = primer toque real"
                 THEN 'whatsapp' ELSE client.channel END,
  updated_at = now()
```

- Idempotente: reejecutar el mismo evento no cambia el resultado.
- No sobrescribe `name/email/notes` no vacíos (respeta edición manual).
- `manual → whatsapp` solo sube; nunca degrada un canal real a manual.

## Entidades reusadas (sin cambios de esquema)

- **`conversation`**: enlaza `client` ↔ hilo de WhatsApp. El atajo "Enviar mensaje" usa
  `getOrCreateConversation(org, clientId, phone)` (helper compartido, DV-CM-5). Defaults existentes:
  `aiEnabled=false`, `needsHuman=false`, `waContactPhone=phone`, `lastMessageAt=now()`.
- **`message`** / **`template`**: la bandeja decide y envía (ventana 24h / plantilla). 009 no los modifica.

## Diagrama de relaciones (texto)

```
organization 1──N client ──(channel: whatsapp|instagram|messenger|manual)
client 1──N conversation 1──N message
client 1──1 client_requirements (007/004, sin cambios)
client 1──N candidacy ──N property (sin cambios; fuente opcional de "interés/etapa" en la lista)
```
