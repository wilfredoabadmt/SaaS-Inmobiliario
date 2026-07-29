# Implementation Plan: Panel de configuración de usuario

**Branch**: `013-user-settings` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-user-settings/spec.md`

## Summary

Convertir el shell vacío `/dashboard/settings` en un panel real con cuatro secciones nuevas —
**Perfil**, **Seguridad**, **Organización**, **Equipo**— reutilizando al máximo la
infraestructura existente y **sin migración de base de datos** (las tablas de Better Auth ya
tienen todo lo necesario: `user.image`, `organization.name`/`logo`, `member`, `invitation`).

Enfoque técnico por sección:

- **Perfil** (todo miembro): editar `user.name` por `PATCH /api/account/profile` (mecanismo único,
  Drizzle); subir avatar con el patrón de subida prefirmada de 2 fases de las fotos de propiedades
  (007) → se guarda la **storage key** en `user.image` y se resuelve a URL prefirmada al render
  (espejo de `resolveMainPhotoUrls`). El riel de navegación lee la fila `user` directa (name/image)
  y pasa de iniciales a la foto (DV-US-15).
- **Seguridad** (todo miembro): cambiar contraseña con `authClient.changePassword`
  (`revokeOtherSessions: true`) y **logout** con `authClient.signOut` (hoy inexistente en la UI).
- **Organización** (solo owner): `PUT /api/organization` (nombre) + subida de logo (mismo patrón
  de 2 fases) → `organization.logo`.
- **Equipo** (solo owner muta): endpoints propios `/api/team/*` con Drizzle directo sobre las
  tablas `member`/`invitation` de Better Auth (no se usa el access-control del plugin, para
  controlar el guardia de "último owner", los mensajes legibles y la degradación de email).
  Invitación por email best-effort vía `lib/mail` (011) con **degradación a enlace copiable**;
  aceptación por ruta `/accept-invitation/[token]` (fuera de `(dashboard)`) con guard de **solo
  sesión** `requireSession` (el invitado puede no tener org activa, DV-US-13) + coincidencia de
  email. Alta del invitado sin cuenta = registro **invite-aware** que NO crea agencia (DV-US-14).

Reutiliza tal cual: `requireMember`/`requireOwner` (guards), `getUploadUrl`/`getDownloadUrl`
(storage S3), `sendMail` (mail best-effort), `newId` (IDs con prefijo), patrón de endpoints
`/api` + Zod, y el `listOrgMembers` existente como base de la lista de equipo.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Next.js 15
App Router, React 19.

**Primary Dependencies**: Better Auth (`emailAndPassword` + plugin `organization`), Drizzle ORM
+ PostgreSQL self-hosted, `@aws-sdk/client-s3` + presigner (R2), `nodemailer` (`lib/mail`), Zod,
Tailwind + shadcn/ui.

**Storage**: PostgreSQL (tablas Better Auth existentes; **sin migración**) + almacenamiento de
objetos S3-compatible (R2) para avatar y logo.

**Testing**: typecheck (`tsc`) + lint (eslint) + build (`next build`) como gate; self-test E2E de
comportamiento conducido por mí (camino feliz + caminos infelices).

**Target Platform**: App Next.js desplegada en Coolify (inmox-dev), Postgres separado.

**Project Type**: Web (monolito Next.js App Router — frontend + API routes en el mismo proyecto).

**Performance Goals**: interacciones de configuración instantáneas a escala humana; subidas de
imagen directas a R2 (no pasan por el servidor de la app).

**Constraints**: aislamiento estricto por tenant (Principio I/III); secretos nunca al cliente;
email best-effort que nunca rompe la UI; la organización nunca queda sin owner.

**Scale/Scope**: agencias de 2–10 usuarios; 4 secciones nuevas, ~10 endpoints, ~6 módulos de
servidor, 5 páginas/forms + ruta de aceptación. Sin migración.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Seguridad de Datos Primero**: ✅ Ningún secreto al cliente; el avatar/logo se guardan como
  storage key y se sirven por URL prefirmada de corta vida; cambio de contraseña delegado a Better
  Auth (hash en `account`). Aislamiento por tenant en toda query (scoped por `organizationId`/
  `userId` del `ActiveContext`). El guardia de último-owner impide dejar la org sin dueño.
- **II. Soberanía / Self-Hosted**: ✅ Auth y Postgres self-hosted; objetos solo vía interfaz S3
  estándar (`lib/storage`), portable a MinIO. Email vía SMTP propio.
- **III. Multi-Tenancy Real**: ✅ Roles owner/agent ya modelados; cada acción evalúa rol dentro
  del tenant activo (`requireMember`/`requireOwner`); `organization_id` es de primer nivel.
- **IV. Idempotencia**: ✅ No hay webhooks nuevos. La aceptación de invitación es idempotente
  (`insert member onConflictDoNothing`); doble confirm de subida no duplica (clave única por
  objeto). No aplica firma de webhook.
- **V. Calidad Verificable**: ✅ Gate typecheck+lint+build + self-test E2E; lo no automatizable
  (recepción visual del correo real) se marca pendiente de verificación humana.
- **VI. Specs Antes de Código**: ✅ spec.md aprobada → este plan → tasks → implement.
- **VII. Trazabilidad**: ✅ Decisiones DV-US-1…12 en research.md.
- **VIII. Foco Vertical Inmobiliario**: ✅ Configura las cuentas y equipos de las **agencias
  inmobiliarias** (owner = dueño de agencia, agent = asesor); sirve a la operación del CRM.

**Resultado**: PASS. Sin violaciones → Complexity Tracking vacío.

## Project Structure

### Documentation (this feature)

```text
specs/013-user-settings/
├── plan.md              # Este archivo
├── spec.md              # Especificación (ya aprobada)
├── research.md          # Fase 0 — decisiones DV-US-1…12
├── data-model.md        # Fase 1 — entidades reutilizadas + keys de storage
├── quickstart.md        # Fase 1 — guía de self-test E2E
├── contracts/
│   └── api.md           # Fase 1 — contrato de endpoints
└── checklists/
    └── requirements.md  # Checklist de calidad de la spec
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # MOD: riel muestra avatar (foto) + acceso a perfil
│   │   └── settings/
│   │       ├── page.tsx                    # MOD: tarjetas a Perfil/Seguridad/Organización/Equipo
│   │       ├── account/page.tsx            # NEW: Perfil (nombre + avatar)
│   │       ├── security/page.tsx           # NEW: contraseña + logout
│   │       ├── organization/page.tsx       # NEW: nombre + logo (owner)
│   │       └── team/page.tsx               # NEW: miembros + invitaciones (owner)
│   ├── accept-invitation/[token]/page.tsx  # NEW: aceptar invitación (exige sesión)
│   └── api/
│       ├── account/
│       │   ├── profile/route.ts            # NEW: PATCH nombre (o vía updateUser client)
│       │   └── avatar/route.ts             # NEW: POST sign/confirm avatar
│       ├── organization/
│       │   ├── route.ts                    # NEW: GET/PUT nombre (owner)
│       │   └── logo/route.ts               # NEW: POST sign/confirm logo (owner)
│       └── team/
│           ├── members/route.ts            # NEW: GET lista (owner)
│           ├── members/[userId]/route.ts   # NEW: PATCH rol / DELETE miembro (owner)
│           ├── invitations/route.ts        # NEW: GET lista / POST invitar (owner)
│           └── invitations/[token]/route.ts# NEW: DELETE cancelar / POST accept
├── server/
│   ├── account/profile.ts                  # NEW: updateName, signAvatar, confirmAvatar, resolveAvatarUrl
│   ├── organization/settings.ts            # NEW: getOrg, updateOrg, signLogo, confirmLogo, resolveLogoUrl
│   └── team/
│       ├── members.ts                      # NEW: listMembers, changeRole, removeMember, last-owner guard
│       └── invitations.ts                  # NEW: list, create(+mail), cancel, accept
├── lib/
│   ├── auth/guards.ts                      # MOD: añadir requireSession() (solo sesión, sin org)
│   ├── db/ids.ts                           # MOD: prefijos member/invitation
│   ├── mail/templates.ts                   # MOD: plantilla de invitación
│   ├── account/schemas.ts                  # NEW: Zod (nombre, avatar, password client)
│   ├── organization/schemas.ts             # NEW: Zod (nombre, logo)
│   └── team/schemas.ts                     # NEW: Zod (invite, role)
└── components/
    ├── settings/                           # NEW: forms de perfil/seguridad/organización/equipo
    ├── auth/{register,login}-form.tsx      # MOD: invite-aware (?invite → no crea org, vuelve al accept)
    └── layout/sidebar-nav.tsx              # (sin cambio funcional; el avatar vive en layout)
```

**Structure Decision**: Monolito Next.js App Router existente. Se añaden páginas bajo
`(dashboard)/settings/*` y una ruta pública-autenticada `/accept-invitation/[token]`; la lógica
vive en `src/server/<área>` (Drizzle) detrás de endpoints `/api/<área>` con guards y Zod, espejo
exacto de features previas (007 fotos, 011 mail, 009 contactos). **No se toca** WhatsApp/
Instagram/Calendario.

## Complexity Tracking

> Sin violaciones constitucionales. No aplica.
