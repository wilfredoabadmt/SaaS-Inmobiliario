# Contract — UI de autenticación (002-auth-ui)

Contratos de interfaz para esta feature: rutas, comportamiento observable, llamadas al
SDK de Better Auth y comportamiento del guard server-side. No son endpoints REST
nuevos (Better Auth ya expone `/api/auth/[...all]`); son los **contratos de pantalla y
de flujo** que la implementación debe cumplir y que las pruebas verifican.

## Rutas

| Ruta | Grupo | Acceso | Render |
|------|-------|--------|--------|
| `/register` | `(auth)` | público (sin sesión) | client form montado en server page |
| `/login` | `(auth)` | público (sin sesión) | client form montado en server page |
| `/inbox` | `(dashboard)` | requiere sesión + org activa | destino tras auth |

### Guard del grupo `(auth)` — `src/app/(auth)/layout.tsx`
- **Entrada**: request a `/login` o `/register`.
- **Comportamiento**: server component. Si `auth.api.getSession()` devuelve sesión →
  `redirect("/inbox")` (FR-009). Si no hay sesión → renderiza el formulario.
- **Contrato observable**: un usuario autenticado NUNCA ve los formularios de auth.

### Guard del grupo `(dashboard)` — ya existe, sin cambios
- Si `getActiveContext()` es `null` → `redirect("/login")` (FR-010).

## Flujo de Registro (US1)

**Pantalla**: campos `email`, `password`, `agencyName`; botón "Crear cuenta".

**Validación cliente (Zod) antes de enviar** (FR-002):
- `email` formato válido · `password` ≥ 8 · `agencyName` no vacío (trim).
- Errores por campo; el envío no procede si hay errores.

**Secuencia al enviar (datos válidos)**:
1. `authClient.signUp.email({ email, password, name })`
   - `name` del usuario: en v1 se usa el correo o el nombre de agencia como display
     name (decisión menor; documentar en implementación).
2. `authClient.organization.create({ name: agencyName, slug })`
   - `slug` generado según R3 (normalizado + sufijo aleatorio).
   - El creador queda como `member.role = "owner"` (R2).
3. Garantizar organización activa: si la sesión no quedó con `activeOrganizationId`,
   `authClient.organization.setActive({ organizationId })`.
4. `router.replace("/inbox")` (FR-004).

**Estados de error observables**:
- Correo ya registrado → mensaje claro "Ese correo ya está registrado" + permanece en
  pantalla conservando email y agencyName, limpia password (FR-005, Acceptance #2).
- Validación de campo fallida → mensaje por campo (FR-002, Acceptance #3).
- Fallo de red/servicio → mensaje legible y reintentable; sin pantalla en blanco.

**Anti doble-submit**: botón `disabled` mientras la secuencia está en vuelo (FR-013).

## Flujo de Login (US2)

**Pantalla**: campos `email`, `password`; botón "Iniciar sesión".

**Secuencia al enviar**:
1. `authClient.signIn.email({ email, password })`.
2. El `databaseHooks.session.create.before` (server) fija `activeOrganizationId` a la
   primera membresía del usuario (R1).
3. `router.replace("/inbox")` (FR-007).

**Estados de error observables**:
- Credenciales inválidas (correo inexistente **o** contraseña incorrecta) → **mensaje
  genérico único** "Correo o contraseña incorrectos", sin revelar existencia del correo
  (FR-008 / SC-006). Permanece en pantalla.
- Fallo de red/servicio → mensaje legible y reintentable.

**Anti doble-submit**: botón `disabled` mientras la llamada está en vuelo (FR-013).

## Contrato server-side: resolución de organización activa

**Ubicación**: `src/lib/auth/index.ts` (config de `betterAuth`).

**Contrato**: en `databaseHooks.session.create.before`, antes de persistir una sesión
cuyo `activeOrganizationId` es nulo, buscar `member` por `userId` (orden estable, p. ej.
`createdAt` asc) y, si existe, fijar `activeOrganizationId` a `member.organizationId`.

**Invariante resultante**: toda sesión de un usuario con al menos una membresía queda
con `activeOrganizationId` poblado. Un usuario sin ninguna membresía (no debería
ocurrir tras el registro) no queda atrapado: el dashboard lo redirige a `/login`
(degradación segura; ver Edge Cases del spec).

## Seguridad (Principio I — verificable en revisión)
- Ningún mensaje de error revela si un correo existe (login).
- No se imprime contraseña ni token en consola, logs ni respuestas (FR-014).
- Las pantallas de auth no consultan datos por-tenant (renderizan sin sesión).

## Criterios de aceptación trazables
| Contrato | Spec |
|----------|------|
| Registro crea cuenta+agencia+owner+org activa y va a /inbox | US1 #1, FR-003/004 |
| Correo duplicado en registro → mensaje claro, conserva campos | US1 #2, FR-005 |
| Validación por campo bloquea envío | US1 #3, FR-002 |
| Autenticado en /register o /login → /inbox | US1 #4 / US2 #3, FR-009 |
| Login correcto → sesión + org activa + /inbox | US2 #1, FR-007/011 |
| Credenciales inválidas → mensaje genérico | US2 #2, FR-008 |
| Sin sesión en ruta de panel → /login | US2 #4, FR-010 |
| Marca "Inmox" en pantallas de auth | FR-012 |
| Botón deshabilitado en vuelo | FR-013 |
