# API Contracts — 013 Panel de configuración de usuario

Todos los endpoints `/api/*` devuelven errores con la forma `{ error: { code, message } }` y usan
`authErrorResponse` para 401/403. Todo está scoped por el `ActiveContext` (`userId`/
`organizationId`/`role`) resuelto por los guards. **Contraseña y logout no tienen endpoint propio**
(se hacen con `authClient.changePassword` / `authClient.signOut` en el cliente).

Convención de subida de imagen (avatar y logo) = 2 fases, espejo de fotos 007:
- `phase: "sign"` → body `{ phase, contentType }` → 200 `{ id, storageKey, uploadUrl }`
- cliente hace `PUT uploadUrl` con el binario y el `Content-Type`
- `phase: "confirm"` → body `{ phase, id, storageKey, contentType, sizeBytes }` → 200 `{ url }`
  (URL prefirmada de descarga del nuevo objeto)

---

## Perfil (requireMember)

### `PATCH /api/account/profile`
Edita el nombre visible. *(Alternativa: `authClient.updateUser({ name })` directo desde el cliente;
si se usa endpoint, este es el contrato.)*
- Body: `{ name: string (1..100) }`
- 200: `{ ok: true, name }`
- 422: nombre inválido.

### `POST /api/account/avatar`
Sube/cambia el avatar (2 fases).
- `sign`: `{ phase:"sign", contentType }` → `{ id, storageKey, uploadUrl }` · 422 tipo inválido.
- `confirm`: `{ phase:"confirm", id, storageKey, contentType, sizeBytes }` → `{ url }`
  - valida `storageKey` empieza por `avatars/{userId}/`; persiste `user.image = storageKey`.
  - 422: key fuera de espacio del usuario o size > 5 MB.

---

## Seguridad (cliente, sin endpoint)

- Cambiar contraseña: `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions:true })`
  - éxito → toast OK; error (`INVALID_PASSWORD`/similar) → "La contraseña actual no es correcta".
- Logout: `authClient.signOut()` → `router.replace("/login")`.

---

## Organización (requireOwner)

### `GET /api/organization`
- 200: `{ id, name, logoUrl|null }` (logoUrl = presigned si hay key). *(O resuelto en server component.)*

### `PUT /api/organization`
- Body: `{ name: string (1..100) }`
- 200: `{ ok:true, name }` · 422 inválido · 403 si agente.

### `POST /api/organization/logo`
Sube/cambia el logo (2 fases). Key `org-logos/{orgId}/…`. Persiste `organization.logo`. 403 si agente.

---

## Equipo (requireOwner para todo, salvo accept)

### `GET /api/team/members`
- 200: `{ members: [{ userId, name, email, role, joinedAt }] }` — solo de la org activa.

### `PATCH /api/team/members/[userId]`
Cambia el rol.
- Body: `{ role: "owner"|"agent" }`
- 200: `{ ok:true }`
- 409: degradar al **único owner** → `{ code:"last_owner", message:"La agencia debe conservar al menos un dueño" }`
- 404: el usuario no es miembro de esta org (aislamiento) · 403 si agente.

### `DELETE /api/team/members/[userId]`
Elimina al miembro de la organización (borra la fila `member`).
- 200: `{ ok:true }`
- 409: eliminar al **único owner** → `last_owner`.
- 404: no miembro de esta org · 403 si agente.

### `GET /api/team/invitations`
- 200: `{ invitations: [{ id, email, role, status, expiresAt }] }` — pending de la org.

### `POST /api/team/invitations`
Crea invitación + email best-effort.
- Body: `{ email: string(email), role: "owner"|"agent" }`
- 201: `{ invitation:{ id, email, role, status, expiresAt }, acceptUrl, emailSent: boolean }`
  - `emailSent:false` → la UI muestra `acceptUrl` para copiar (degradación).
- 409: `{ code:"already_member" }` o `{ code:"already_invited" }` (mensaje legible).
- 422: email/rol inválido · 403 si agente.

### `DELETE /api/team/invitations/[token]`
Cancela una invitación pendiente (status → cancelled).
- 200: `{ ok:true }` · 404: no existe en esta org · 403 si agente.

### `POST /api/team/invitations/[token]`  *(requireSession — el invitado autenticado, puede NO tener org activa)*
Acepta la invitación.
- Pre: **solo sesión** (no requiere `activeOrganizationId`); `session.user.email == invitation.email`
  (case-insensitive). Usa `requireSession()`, no `requireMember` (un invitado recién registrado aún
  no es miembro de ninguna org).
- Efecto: `insert member onConflictDoNothing`; `invitation.status = accepted`.
- 200: `{ ok:true, organizationId }` (el cliente hace `setActive` + redirige a `/inbox`).
- 400/409/410: `{ code: "invalid"|"email_mismatch"|"expired"|"already_used", message }` legible.

---

## Página de aceptación

`/accept-invitation/[token]` (Server Component, **fuera de `(dashboard)`**):
1. Lee la invitación por `token`. Si no existe/expirada/usada → muestra estado legible.
2. Sin sesión → alta/login **invite-aware**: el registro crea **solo la cuenta** (sin agencia) y el
   login normal; ambos parametrizados por `?invite={token}` y **vuelven aquí** tras autenticarse
   (no usan `organization.create`/`setActive`).
3. Con sesión y email coincidente → botón "Unirme a {org}" → `POST /api/team/invitations/[token]`
   → cliente hace `setActive(organizationId)` + redirige a `/inbox`.
4. Email no coincide → "Esta invitación es para {email}. Inicia sesión con ese correo."

### Guard `requireSession()` (nuevo, en `src/lib/auth/guards.ts`)
Devuelve `{ userId, email }` desde `auth.api.getSession` exigiendo **solo** usuario autenticado
(sin `activeOrganizationId`). Lanza `AuthorizationError(401)` si no hay sesión. Lo usa la aceptación
de invitaciones; el resto sigue con `requireMember`/`requireOwner`.

## Notas de seguridad / aislamiento

- Toda lectura/mutación de equipo filtra por `organizationId` del owner autenticado; un `userId`/
  `token` de otra org devuelve 404 (no se revela existencia cross-tenant).
- `confirm` de avatar/logo valida el prefijo de la key contra el `userId`/`orgId` del contexto.
- Ningún secreto se devuelve; las imágenes se sirven por presigned de corta vida.
