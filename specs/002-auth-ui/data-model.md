# Data Model — UI de autenticación (002-auth-ui)

Esta feature **no introduce ni modifica tablas**. Consume el esquema de Better Auth ya
migrado (`src/lib/db/schema/auth.ts`). Se documentan aquí las entidades tocadas por el
flujo y las reglas que la UI debe respetar.

## Entidades consumidas

### `user`
- Campos relevantes: `id` (text, PK), `name` (no nulo), `email` (no nulo, **UNIQUE**),
  `emailVerified` (default `false`), timestamps.
- **Creación**: ocurre en `authClient.signUp.email({ email, password, name })`.
- **Regla UI**: `email` único → un registro con correo existente debe fallar y
  comunicarse como "correo ya registrado" (FR-005). La contraseña nunca se persiste en
  claro (la gestiona Better Auth en `account.password`, hasheada).

### `session`
- Campos relevantes: `id`, `userId`, `token` (UNIQUE), `expiresAt`,
  **`activeOrganizationId`** (nullable).
- **Regla central (R1)**: `activeOrganizationId` MUST quedar poblado para que
  `getActiveContext()` resuelva tenant + rol. Mecanismo:
  - Login / sesión nueva → `databaseHooks.session.create.before` lo fija a la primera
    membresía del usuario.
  - Registro → se fija explícitamente tras crear la organización.

### `organization` (agencia / tenant)
- Campos relevantes: `id`, `name` (no nulo, **visible, NO único**), `slug` (**UNIQUE**,
  nullable), `logo`, `metadata`, `createdAt`.
- **Creación**: en el registro vía `authClient.organization.create({ name, slug })`.
- **Reglas UI**:
  - `name` = nombre de agencia tal cual lo escribe el dueño (no vacío, FR-002).
  - `slug` = nombre normalizado + sufijo aleatorio para garantizar unicidad (R3).
  - Dos agencias pueden compartir `name` (Edge Case); el `slug` las distingue.

### `member` (membresía)
- Campos relevantes: `id`, `organizationId` (FK), `userId` (FK), `role` (text, default
  de tabla `"member"`), `createdAt`.
- **Creación**: el plugin `organization` crea la membresía del creador con `role`
  = `"owner"` (R2).
- **Regla**: `getActiveContext()` mapea `role === "owner"` → `owner`, cualquier otro →
  `agent`. El registro produce siempre un `owner`.

### `invitation`
- **No se usa en esta feature.** El alta de agentes por invitación es US3 (FR-015,
  fuera de alcance).

## Estado derivado: "Agencia activa de la sesión"
- No es una tabla; es `session.activeOrganizationId` interpretado por
  `getActiveContext()` junto con `member.role`.
- **Invariante**: tras registro o login exitoso, una sesión válida tiene
  `activeOrganizationId` que apunta a una `organization` donde el `user` tiene `member`.

## Reglas de validación (cliente, antes de llamar al SDK)
| Campo | Regla | FR |
|-------|-------|----|
| email | formato de correo válido | FR-002 |
| password (registro) | mínimo de seguridad (≥ 8) | FR-002 |
| password (login) | no vacío | FR-006 |
| agencyName (registro) | no vacío, se recorta espacios | FR-002 |

> El mínimo de contraseña en el cliente debe **coincidir** con el que aplica Better
> Auth en servidor; si difieren, el servidor es la autoridad. Verificar en quickstart.
