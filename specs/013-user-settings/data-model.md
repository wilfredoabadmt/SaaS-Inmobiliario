# Data Model — 013 Panel de configuración de usuario

**Sin migración.** Esta feature no crea ni altera tablas/columnas. Reutiliza el schema existente
de Better Auth (`src/lib/db/schema/auth.ts`). Documenta aquí cómo se usan los campos existentes y
las claves de almacenamiento de objetos.

## Entidades reutilizadas (Better Auth)

### `user`
| Campo | Tipo | Uso en esta feature |
|-------|------|---------------------|
| `id` | text PK (`usr_…`) | identidad del miembro |
| `name` | text NOT NULL | **editable** en Perfil (`updateUser`) |
| `email` | text UNIQUE | **solo lectura** en Perfil; clave de match en aceptación de invitación |
| `image` | text NULL | **storage key** del avatar (`avatars/{userId}/{id}.{ext}`); render → presigned GET |
| `emailVerified`, `createdAt`, `updatedAt` | — | sin cambio |

### `organization`
| Campo | Tipo | Uso |
|-------|------|-----|
| `id` | text PK (`org_…`) | tenant |
| `name` | text NOT NULL | **editable** en Organización (owner) |
| `logo` | text NULL | **storage key** del logo (`org-logos/{orgId}/{id}.{ext}`); render → presigned GET |
| `slug`, `metadata`, `createdAt` | — | sin cambio |

### `member`
| Campo | Tipo | Uso |
|-------|------|-----|
| `id` | text PK (`mem_…`, **nuevo prefijo**) | fila de membresía (insertada al aceptar invitación) |
| `organizationId` | text FK | scope de tenant (toda query filtra por aquí) |
| `userId` | text FK | miembro |
| `role` | text (`owner`/`agent`) | **editable** por owner (cambiar rol); guardia de último owner |
| `createdAt` | timestamp | "fecha de alta" en la lista de equipo |

UNIQUE lógico (organizationId, userId): la aceptación usa `onConflictDoNothing` para idempotencia.

### `invitation`
| Campo | Tipo | Uso |
|-------|------|-----|
| `id` | text PK (`inv_…`, **nuevo prefijo**) | **token** del enlace de aceptación |
| `organizationId` | text FK | tenant que invita |
| `email` | text NOT NULL | destinatario (normalizado trim+lowercase) |
| `role` | text NULL | rol a asignar al aceptar (`owner`/`agent`) |
| `status` | text default `pending` | `pending` → `accepted` / `cancelled`; expirada si `expiresAt < now` |
| `expiresAt` | timestamp NOT NULL | +7 días al crear |
| `inviterId` | text FK → user | owner que invitó |

## Cambios de código de datos (no de schema)

`src/lib/db/ids.ts` — añadir al `ID_PREFIXES`:
```ts
member: "mem",
invitation: "inv",
```
(Better Auth genera estos IDs cuando usa sus propios flujos; como insertamos `member`/`invitation`
manualmente con `newId`, necesitamos los prefijos.)

## Claves de almacenamiento (R2 / S3)

| Objeto | Patrón de key | Tipos | Límite |
|--------|---------------|-------|--------|
| Avatar de usuario | `avatars/{userId}/{id}.{ext}` | jpeg/png/webp | 5 MB |
| Logo de organización | `org-logos/{orgId}/{id}.{ext}` | jpeg/png/webp | 5 MB |

`{id}` = `newId("propertyPhoto")`-style nanoid local al objeto (no requiere prefijo de entidad;
puede ser un nanoid simple). `ext` derivado del contentType. Validación de prefijo en `confirm`
(la key debe empezar por `avatars/{userId}/` o `org-logos/{orgId}/`) para impedir escribir fuera
del espacio del tenant/usuario.

## Estados y transiciones

**Invitación**: `pending` --(aceptar válido)--> `accepted` · `pending` --(cancelar owner)-->
`cancelled` · `pending` --(expiresAt<now)--> *expirada* (estado derivado, no se persiste un valor
aparte; se trata como inválida al aceptar).

**Rol de miembro**: `owner ⇄ agent` por owner, **excepto** degradar al único owner (bloqueado).

**Avatar/logo**: ausente (iniciales / sin logo) → presente (storage key) — siempre reemplazo, sin
historial.

## Reglas de validación (resumen, ver schemas Zod)

- Nombre de usuario / agencia: trim, 1–100 chars, no vacío.
- Email de invitación: formato email válido; normalizado lowercase.
- Rol de invitación / cambio de rol: enum `owner` | `agent`.
- Imagen: contentType ∈ {jpeg,png,webp}; sizeBytes ≤ 5 MB.
- Contraseña nueva: ≥ 8 chars (igual que el registro); la actual la valida Better Auth.
