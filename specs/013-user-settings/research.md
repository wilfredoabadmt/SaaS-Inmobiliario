# Research — 013 Panel de configuración de usuario

Decisiones técnicas (DV-US-n) tomadas para resolver el plan. Formato: Decisión · Razón ·
Alternativas descartadas. Sirven de criterios de verificación en el self-test.

## DV-US-1 — Gestión de equipo con endpoints propios + Drizzle, no el access-control del plugin

**Decisión**: Las mutaciones de equipo (listar, invitar, aceptar, cambiar rol, eliminar) se
implementan con endpoints `/api/team/*` propios que escriben con Drizzle directo sobre las tablas
`member`/`invitation` de Better Auth, protegidos por `requireOwner`. NO se usa el sistema de
access-control / `inviteMember`/`updateMemberRole`/`removeMember` del plugin `organization`.

**Razón**: (a) Nuestros roles son `owner`/`agent`; `agent` no es un rol del access-control por
defecto de Better Auth (owner/admin/member), así que usar el plugin exigiría configurar `ac`
custom y arriesgar fricción. (b) El spec pide guardias y mensajes muy específicos —último owner no
puede degradarse/eliminarse, duplicados legibles, degradación a enlace cuando el email falla— que
controlamos mejor con código propio. (c) El repo ya lee `member` con Drizzle directo
(`listOrgMembers`); es el patrón de la casa.

**Alternativas descartadas**: usar `authClient.organization.inviteMember/...` con `createAccessControl`
custom → más configuración, el guardia de último-owner no está garantizado por el plugin y habría
que envolverlo igual.

## DV-US-2 — Sin migración de base de datos

**Decisión**: La feature no añade ni altera columnas. Reutiliza: `user.image` (avatar),
`organization.name`/`organization.logo`, `member` (id, organizationId, userId, role, createdAt) e
`invitation` (id, organizationId, email, role, status, expiresAt, inviterId). La **`invitation.id`
es el token** del enlace de aceptación.

**Razón**: El schema de Better Auth ya modela identidad, membresía e invitaciones. Añadir tablas
sería duplicar. El único cambio en código de datos es agregar prefijos `member`/`invitation` a
`newId` (las insertamos manualmente).

**Alternativas descartadas**: tabla propia de invitaciones con `token` aparte → redundante;
`invitation.id` (nanoid con prefijo, no adivinable) ya sirve de token.

## DV-US-3 — Avatar y logo: storage key + URL prefirmada al render (espejo de fotos 007)

**Decisión**: Subida en 2 fases como las fotos de propiedades: (1) `sign` valida tipo/tamaño y
firma un PUT directo a R2 devolviendo `{ storageKey, uploadUrl }`; el cliente sube el binario
directo a R2; (2) `confirm` valida que la key pertenece al prefijo del usuario/org y persiste la
**storage key** en `user.image` / `organization.logo`. Al render (server component) se resuelve a
URL prefirmada de descarga (`getDownloadUrl`, ~1 h), igual que `resolveMainPhotoUrls`. Claves:
`avatars/{userId}/{id}.{ext}` y `org-logos/{orgId}/{id}.{ext}`.

**Razón**: Reusa exactamente el patrón probado de 007; no expone presigned permanentes; portable a
MinIO; el binario nunca pasa por el servidor de la app.

**Alternativas descartadas**: (a) guardar URL pública directa → R2 no es público por defecto y
acoplaría a una URL fija; (b) ruta proxy pública con HMAC (008) → más superficie de la necesaria
para imágenes internas de baja sensibilidad; el presigned-al-render basta.

## DV-US-4 — Invitación por email best-effort con degradación a enlace copiable

**Decisión**: `POST /api/team/invitations` crea la fila `invitation` (status `pending`,
`expiresAt` = +7 días) y **luego** intenta `sendMail` (de `lib/mail`, 011). La respuesta incluye
`{ invitation, acceptUrl, emailSent }`. Si `emailSent === false` (email OFF o fallo), la UI
muestra `acceptUrl` para copiar. El enlace es `${APP_BASE_URL}/accept-invitation/{invitation.id}`.

**Razón**: `sendMail` ya es best-effort (nunca lanza, devuelve boolean). Cumple FR-020 sin acoplar
la creación de la invitación al correo. El owner siempre obtiene un enlace usable.

**Alternativas descartadas**: fallar la invitación si el email no se envía → rompe el flujo y
contradice la degradación pedida.

## DV-US-5 — Aceptación: exige sesión + coincidencia de email + idempotente

**Decisión**: Ruta `/accept-invitation/[token]`. Si no hay sesión → redirige a `/login?invite={token}`
(y de vuelta tras autenticarse/registrarse). Con sesión, `POST /api/team/invitations/[token]`
(accept) valida: invitación existe, `status = pending`, no expirada, y el **email de la sesión
coincide** (case-insensitive) con `invitation.email`. Si todo OK: `insert member`
(`onConflictDoNothing` por (organizationId,userId) → idempotente), marca `invitation.status =
accepted`, y el cliente hace `setActive` a esa organización. Errores → mensajes legibles
(expirada/usada/otro-correo/inválida).

**Razón**: Evita que un enlace filtrado lo acepte un tercero; idempotencia ante doble clic;
coherente con la resolución de org activa (R1).

**Alternativas descartadas**: aceptar con cualquier sesión sin verificar email → riesgo de
secuestro de invitación.

## DV-US-6 — Guardia de "último owner"

**Decisión**: Antes de degradar (`owner→agent`) o eliminar un miembro cuyo rol es `owner`, contar
los owners de la organización; si es **1**, bloquear con mensaje legible. Cubre tanto cambiar el
rol de otro owner como auto-degradarse/auto-eliminarse el único owner. La organización siempre
conserva ≥1 owner.

**Razón**: FR-017 / SC-006: nunca dejar la org sin dueño (quedaría inadministrable).

**Alternativas descartadas**: permitir y "auto-promover" a otro → comportamiento sorpresa; mejor
bloquear explícito.

## DV-US-7 — Matriz de permisos reutilizando guards existentes

**Decisión**: Perfil y Seguridad = `requireMember` (owner y agent). Organización (editar) y
Equipo (listar y mutar) = `requireOwner`. Un agente que invoque endpoints de owner recibe **403**
vía `requireOwner` + `authErrorResponse`. Toda query/mutación se scoping por el `organizationId`/
`userId` del `ActiveContext` (aislamiento de tenant por defecto).

**Razón**: Reusa los guards probados; sin nueva capa de autorización.

**Alternativas descartadas**: permitir a agentes ver el equipo en solo-lectura → el dueño lo pidió
owner-only; mantener simple.

## DV-US-8 — Contraseña y logout vía Better Auth (no endpoints propios)

**Decisión**: Cambio de contraseña con `authClient.changePassword({ currentPassword, newPassword,
revokeOtherSessions: true })`; logout con `authClient.signOut()` + `router.replace("/login")`. Sin
endpoints `/api` propios para estos.

**Razón**: Las contraseñas se hashean en `account` por Better Auth; reimplementar sería inseguro.
`changePassword` ya valida la contraseña actual y expone error legible (mapeado en la UI).

**Alternativas descartadas**: endpoint propio que toque `account.password` → reinventa el hashing
de Better Auth; prohibido.

## DV-US-9 — Detección de duplicados al invitar

**Decisión**: Antes de crear la invitación, normalizar el email (trim+lowercase) y rechazar con
mensaje legible si: (a) ya existe un `member` cuyo `user.email` coincide en la org, o (b) ya existe
una `invitation` `pending` no expirada con ese email en la org. No se crean duplicados.

**Razón**: FR-019; evita correos repetidos y filas basura.

**Alternativas descartadas**: índice UNIQUE en (organizationId,email) → demasiado rígido
(invitaciones canceladas/expiradas deberían poder re-emitirse); validación en servicio es más
flexible.

## DV-US-10 — Ubicación del logout y del avatar en la navegación

**Decisión**: El botón de **logout** vive en la página de Seguridad (claro y descubrible). El
**avatar** del riel pasa a mostrar `user.image` (foto prefirmada) y enlaza a `/settings/account`;
si no hay imagen, cae a las iniciales actuales. (Un menú desplegable en el avatar es mejora futura,
fuera del MVP.)

**Razón**: Mínimo viable que cumple "logout accesible desde la UI" (SC-003) sin rediseñar el riel.

**Alternativas descartadas**: dropdown completo en el avatar ahora → más UI de la necesaria para
el cierre de la feature.

## DV-US-11 — Validación de imagen (tipo/tamaño)

**Decisión**: Zod en la fase `sign`: `contentType ∈ {image/jpeg, image/png, image/webp}` y, en
`confirm`, `sizeBytes ≤ 5 MB`. Tipos/sizes inválidos → 422 con mensaje legible; el avatar/logo
previo no cambia (solo se persiste en `confirm`).

**Razón**: Espejo de `photoPostSchema` (007), suficiente para fotos de perfil/logo.

**Alternativas descartadas**: aceptar cualquier tipo → riesgo de subir binarios arbitrarios al
bucket.

## DV-US-12 — Reflejo inmediato de nombre/avatar en la navegación

**Decisión**: Tras guardar perfil, el cliente hace `router.refresh()` (revalida el server
component del layout) para que el riel muestre el nuevo nombre/foto sin recarga completa.
`authClient.updateUser` actualiza la sesión; el layout (server) re-resuelve `user`.

**Razón**: SC-001 (reflejado en <1 min, sin recargar la app entera).

**Alternativas descartadas**: estado global cliente para el avatar → innecesario; el layout ya es
server component y `refresh()` basta.

## DV-US-13 — Aceptar invitación con guard de SOLO sesión (no requireMember)

**Decisión**: El endpoint de aceptación (`POST /api/team/invitations/[token]`) y la página
`/accept-invitation/[token]` usan un guard nuevo `requireSession()` (lee `auth.api.getSession` y
exige solo usuario autenticado), **no** `requireMember`/`requireOwner`.

**Razón** (resuelve **G1** del analyze): un invitado con cuenta recién creada **no tiene
`activeOrganizationId`** hasta que acepta; `requireMember` devolvería 401 y la aceptación sería
imposible. La aceptación es precisamente lo que le da su primera membresía. La página vive **fuera
de `(dashboard)`** para no chocar con el redirect a `/login` del layout (que sí exige org activa).

**Alternativas descartadas**: auto-fijar una org activa antes de aceptar → no hay ninguna que
fijar; el invitado aún no pertenece a nada.

## DV-US-14 — Alta del invitado SIN cuenta: registro invite-aware sin crear agencia

**Decisión**: Cuando un invitado sin cuenta abre el enlace, el alta crea **solo la cuenta**
(`authClient.signUp.email`) y **NO** crea una organización; tras autenticarse vuelve a
`/accept-invitation/[token]` y acepta, quedando como `member` de la org **invitada**. El
`RegisterForm`/`LoginForm` se parametrizan por `?invite=token`: con `invite` presente, el registro
**omite** `organization.create`/`setActive` y redirige de vuelta a la aceptación.

**Razón** (resuelve **G2**): el `RegisterForm` actual siempre crea una agencia y deja al usuario
como owner de ella; un invitado terminaría con **dos** organizaciones (la suya + la invitada). El
invitado no debe fundar una agencia: solo unirse a la que lo invitó.

**Alternativas descartadas**: (a) dejar que cree su org y luego acepte → 2 orgs, confuso y rompe la
resolución de org activa (R1 toma la primera membresía). (b) Alta dedicada totalmente separada del
`RegisterForm` → duplicaría el formulario; mejor parametrizar el existente.

## DV-US-15 — Mecanismo único para el nombre + reflejo por lectura fresca de BD

**Decisión** (resuelve **C1/U1**): el **nombre** se edita por `PATCH /api/account/profile`
(Drizzle sobre `user.name`), **un solo mecanismo** (no `authClient.updateUser`). El riel
(`layout.tsx`) lee la fila `user` (name, image) **directamente por `userId`** —no vía
`getActiveContext`, que solo expone `role`— de modo que el cambio se refleja por lectura fresca de
BD + `router.refresh()` sin depender del caché de sesión.

**Razón**: evita la ambigüedad de doble mecanismo y el riesgo de que un `updateUser` no refresque
la vista; la lectura directa de la tabla `user` es determinista.

**Alternativas descartadas**: `authClient.updateUser` para nombre/imagen → dependía del refresco de
sesión y duplicaba el camino con el endpoint.

## Verificación funcional (mapa a self-test, quickstart.md)

Camino feliz: editar nombre+avatar→riel actualizado · cambiar contraseña→re-login con la nueva ·
logout→login · owner edita nombre/logo de agencia · owner invita→crea invitación + (email o enlace)
→aceptar desde otra cuenta→aparece en lista · cambiar rol · eliminar miembro.

Camino infeliz: agente→403 en equipo/organización · único owner no puede degradarse/eliminarse ·
aislamiento de tenant (no ver/mutar otra org) · contraseña actual incorrecta→error legible · email
ya miembro/ya invitado→legible · imagen inválida→422 · invitación expirada/usada/otro-correo→
legible · fallo de email→enlace copiable.
