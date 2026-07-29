# Tasks: Panel de configuración de usuario (013-user-settings)

**Feature dir**: `specs/013-user-settings/` · **Plan**: [plan.md](./plan.md) · **Contratos**:
[contracts/api.md](./contracts/api.md) · **Self-test**: [quickstart.md](./quickstart.md)

**Sin migración** (reutiliza tablas Better Auth). Roles: owner / agent. Aislamiento por tenant en
toda query (`organizationId`/`userId` del `ActiveContext`).

Formato: `- [ ] [Tid] [P?] [Story?] descripción con ruta`. `[P]` = paralelizable (archivos
distintos, sin dependencia pendiente).

---

## Phase 1 — Setup (prerequisitos compartidos)

- [x] T001 Añadir prefijos `member: "mem"` e `invitation: "inv"` al `ID_PREFIXES` en `src/lib/db/ids.ts`
- [x] T002 [P] Crear schemas Zod de perfil (nombre 1..100; avatar `sign`/`confirm` con contentType ∈ jpeg/png/webp y sizeBytes ≤ 5 MB) en `src/lib/account/schemas.ts`
- [x] T003 [P] Crear schemas Zod de organización (nombre 1..100; logo `sign`/`confirm`) en `src/lib/organization/schemas.ts`
- [x] T004 [P] Crear schemas Zod de equipo (invite `{ email, role }`; cambio de rol `{ role: owner|agent }`) en `src/lib/team/schemas.ts`

---

## Phase 2 — Foundational (bloquean a las historias)

**Objetivo**: piezas compartidas por varias secciones. Completar antes de las historias.

- [x] T005 [P] Helper compartido de imagen: `signImageUpload(prefix, contentType)` (firma PUT R2, valida tipo) + `validateKeyPrefix(key, prefix)` + `resolveImageUrl(key)` (presigned GET, espejo de `resolveMainPhotoUrls`) en `src/server/storage/images.ts`
- [x] T006 [P] Plantilla de email de invitación `renderInvitationMail({ agencyName, inviterName, role, acceptUrl })` (HTML + texto) en `src/lib/mail/templates.ts`
- [x] T007 Actualizar el índice de Configuración con tarjetas a las 4 secciones nuevas (Perfil, Seguridad — visibles a todo miembro; Organización, Equipo — solo owner) en `src/app/(dashboard)/settings/page.tsx`
- [x] T007a [P] Guard de **solo sesión** `requireSession()` (devuelve `{ userId, email }` desde `auth.api.getSession`, **sin** exigir `activeOrganizationId`) para la aceptación de invitados sin org activa, en `src/lib/auth/guards.ts` (resuelve G1)

**Checkpoint**: el panel `/settings` muestra accesos a las 4 secciones (las páginas se construyen en
las fases siguientes); WhatsApp/Instagram intactos.

---

## Phase 3 — US1 Perfil personal y avatar (P1) 🎯 MVP

**Objetivo**: todo miembro edita su nombre y sube avatar; el riel muestra la foto.
**Test independiente**: login → `/settings/account` → cambiar nombre + subir imagen → riel
actualizado tras guardar; imagen inválida → error, sin cambio.

- [x] T008 [US1] Servicio de perfil: `updateName(userId, name)`, `signAvatar(userId, contentType)`, `confirmAvatar(userId, {id, storageKey, contentType, sizeBytes})` (valida prefijo `avatars/{userId}/`, persiste `user.image`), `resolveAvatarUrl(image)` en `src/server/account/profile.ts`
- [x] T009 [US1] Endpoint `PATCH /api/account/profile` (requireMember, actualiza nombre) en `src/app/api/account/profile/route.ts`
- [x] T010 [US1] Endpoint `POST /api/account/avatar` (requireMember, fases sign/confirm) en `src/app/api/account/avatar/route.ts`
- [x] T011 [US1] Form de perfil (nombre editable **vía `PATCH /api/account/profile`** — mecanismo único, no `updateUser` (resuelve C1); email+rol solo lectura; subida de avatar a R2 vía sign→PUT→confirm; `router.refresh()` al guardar) en `src/components/settings/profile-form.tsx`
- [x] T012 [US1] Página `/settings/account` (requireMember; carga nombre/email/rol/avatar actuales) en `src/app/(dashboard)/settings/account/page.tsx`
- [x] T013 [US1] Riel del dashboard: leer la fila `user` (name, image) por `userId` **directamente** (no vía `getActiveContext`, que solo expone role) y mostrar avatar desde `user.image` (presigned vía `resolveAvatarUrl`) con fallback a iniciales, enlazar a `/settings/account`; el reflejo tras guardar se logra por lectura fresca de BD + `router.refresh()` en `src/app/(dashboard)/layout.tsx` (resuelve U1)

**Checkpoint**: US1 entregable y testeable de forma aislada.

---

## Phase 4 — US2 Seguridad: contraseña y logout (P1)

**Objetivo**: cambiar contraseña + cerrar sesión desde la UI.
**Test independiente**: cambiar contraseña → logout → re-login con la nueva; actual incorrecta →
error legible.

- [x] T014 [US2] Form de seguridad: cambio de contraseña con `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions:true })` + mapeo de error legible (contraseña actual incorrecta) + validación nueva ≥ 8 en `src/components/settings/security-form.tsx`
- [x] T015 [US2] Botón "Cerrar sesión" (`authClient.signOut()` → `router.replace("/login")`) en `src/components/settings/logout-button.tsx`
- [x] T016 [US2] Página `/settings/security` (requireMember; monta form + logout) en `src/app/(dashboard)/settings/security/page.tsx`

**Checkpoint**: existe logout funcional en la UI (antes inexistente).

---

## Phase 5 — US3 Datos de la organización (P2)

**Objetivo**: owner edita nombre y logo de la agencia.
**Test independiente**: owner cambia nombre + logo → persiste; agente → 403.

- [x] T017 [US3] Servicio de organización: `getOrg(organizationId)`, `updateName(organizationId, name)`, `signLogo(orgId, contentType)`, `confirmLogo(orgId, {...})` (prefijo `org-logos/{orgId}/`, persiste `organization.logo`), `resolveLogoUrl(logo)` en `src/server/organization/settings.ts`
- [x] T018 [US3] Endpoints `GET /api/organization` + `PUT /api/organization` (requireOwner, nombre) en `src/app/api/organization/route.ts`
- [x] T019 [US3] Endpoint `POST /api/organization/logo` (requireOwner, sign/confirm) en `src/app/api/organization/logo/route.ts`
- [x] T020 [US3] Form de organización (nombre + logo) en `src/components/settings/organization-form.tsx`
- [x] T021 [US3] Página `/settings/organization` (requireOwner; redirige/oculta si agente) en `src/app/(dashboard)/settings/organization/page.tsx`

**Checkpoint**: marca de la agencia editable solo por owner.

---

## Phase 6 — US4 Gestión de equipo e invitaciones (P2)

**Objetivo**: owner lista miembros, invita por email (degrada a enlace), cambia rol, elimina;
invitado acepta.
**Test independiente**: invitar → aceptar desde otra cuenta → aparece; cambiar rol; eliminar;
caminos infelices (403, último owner, duplicado, email OFF, token inválido).

- [x] T022 [US4] Servicio de miembros: `listMembers(orgId)` (userId, name, email, role, joinedAt), `changeRole(orgId, userId, role)`, `removeMember(orgId, userId)` con **guardia de último owner** (cuenta owners; bloquea degradar/eliminar al único owner) y aislamiento (404 si no es miembro de la org) en `src/server/team/members.ts`
- [x] T023 [US4] Servicio de invitaciones: `listInvitations(orgId)`, `createInvitation(orgId, inviterId, email, role)` (normaliza email; rechaza ya-miembro/ya-invitada; crea fila + `sendMail` best-effort; devuelve `{ invitation, acceptUrl, emailSent }`), `cancelInvitation(orgId, id)`, `acceptInvitation(token, sessionUser)` (valida pending+no-expirada+email coincide; `insert member onConflictDoNothing`; marca accepted) en `src/server/team/invitations.ts`
- [x] T024 [US4] Endpoint `GET /api/team/members` (requireOwner) en `src/app/api/team/members/route.ts`
- [x] T025 [US4] Endpoints `PATCH` (rol) + `DELETE` (eliminar) `/api/team/members/[userId]` (requireOwner; 409 `last_owner`; 404 cross-tenant) en `src/app/api/team/members/[userId]/route.ts`
- [x] T026 [US4] Endpoints `GET` (listar) + `POST` (invitar) `/api/team/invitations` (requireOwner; 409 already_member/already_invited) en `src/app/api/team/invitations/route.ts`
- [x] T027 [US4] Endpoints `DELETE` (cancelar, requireOwner) + `POST` (aceptar, **requireSession** — no requireMember, el invitado puede no tener org activa) `/api/team/invitations/[token]` en `src/app/api/team/invitations/[token]/route.ts` (resuelve G1)
- [x] T028 [US4] UI de equipo: lista de miembros (con rol editable owner↔agent y eliminar), form de invitación con rol, y **enlace copiable** cuando `emailSent:false` en `src/components/settings/team-panel.tsx`
- [x] T029 [US4] Página `/settings/team` (requireOwner; carga miembros + invitaciones pendientes) en `src/app/(dashboard)/settings/team/page.tsx`
- [x] T030 [US4] Página de aceptación `/accept-invitation/[token]` (server, **fuera de `(dashboard)`**: lee invitación; sin sesión → muestra alta/login invite-aware (T030a); con sesión y email coincidente → botón aceptar → `POST` + `setActive` + redirige a `/inbox`; estados legibles para inválida/expirada/usada/otro-correo) en `src/app/accept-invitation/[token]/page.tsx`
- [x] T030a [US4] Alta/login **invite-aware** del invitado **sin cuenta**: registro que crea **solo la cuenta** (`authClient.signUp.email`, **sin** crear agencia) y vuelve a `/accept-invitation/[token]` para aceptar; un usuario ya con cuenta inicia sesión y vuelve. Reusar `RegisterForm`/`LoginForm` parametrizados por `?invite=token` (omiten la creación de org cuando hay invite) en `src/components/auth/*` + el componente de aceptación (resuelve G2)

**Checkpoint**: colaboración multi-usuario completa con todos los guardias.

---

## Phase 7 — Polish & verificación

- [x] T031 Gate técnico: `pnpm typecheck && pnpm lint && pnpm build` en verde (corregir hasta limpio)
- [x] T032 Deploy a inmox-dev y **self-test E2E** de comportamiento según [quickstart.md](./quickstart.md) (camino feliz + infeliz); marcar pendiente de verificación humana solo la recepción visual del correo real
- [x] T033 [P] Actualizar memoria del proyecto: nota de cierre de 013 en `MEMORY.md` + archivo de feature (estado, gotchas)

---

## Dependencias y orden

- **Setup (T001–T004)** → antes de todo. T002/T003/T004 en paralelo [P].
- **Foundational (T005–T007a)** → antes de las historias. T005/T006/T007a en paralelo [P]; T007 puede ir
  en paralelo a ellos. **T007a (requireSession) bloquea T027/T030**.
- **US1 (T008–T013)**: T008 → T009/T010 → T011 → T012; T013 depende de T008 (`resolveAvatarUrl`).
- **US2 (T014–T016)**: T014/T015 → T016. Independiente de US1 (puede ir en paralelo).
- **US3 (T017–T021)**: T017 → T018/T019 → T020 → T021. Usa T005 (helper de imagen).
- **US4 (T022–T030a)**: T022/T023 → endpoints T024–T027 → UI T028/T029 + aceptación T030/T030a. Usa
  T006 (mail), T001 (prefijos) y T007a (requireSession para aceptar). T030a (alta invite-aware) es
  prerequisito para que un invitado **sin cuenta** complete el flujo.
- **Polish (T031–T033)** al final.

Las historias US1–US4 son **independientes entre sí** (archivos distintos); el único acoplamiento
es el índice `/settings` (T007) que las enlaza y el helper de imagen (T005) que comparten US1/US3.

## Estrategia de entrega

- **MVP = US1 + US2** (ambas P1): perfil/avatar + contraseña/logout. Entregable y testeable solo.
- Incremento 2: **US3** (organización). Incremento 3: **US4** (equipo, la más compleja).
- Tras cada incremento, gate técnico verde; el self-test E2E completo (T032) cubre las 4 al cierre.

## Resumen

- **Total**: 35 tareas. Setup 4 · Foundational 4 (T005–T007a) · US1 6 · US2 3 · US3 5 · US4 11
  (T022–T030a) · Polish 3.
- **Paralelizables [P]**: T002, T003, T004, T005, T006, T007a, T033 (+ historias entre sí).
- **Sin migración · sin nuevas env vars** (reutiliza SMTP/S3 ya configurados).
- **Remediación analyze aplicada**: G1 (requireSession para aceptar) · G2 (alta invite-aware) ·
  C1 (nombre por endpoint único) · U1 (riel lee fila `user` directa).
