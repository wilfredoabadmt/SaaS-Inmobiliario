---
description: "Task list — UI de autenticación (registro e inicio de sesión)"
---

# Tasks: UI de autenticación (registro e inicio de sesión)

**Input**: Design documents from `specs/002-auth-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-ui.md, quickstart.md

**Tests**: NO solicitados en el spec. La verificación es por puerta de calidad
(typecheck + lint + build, Principio V) + recorrido en navegador real con Playwright MCP
marcado como verificación humana asistida. No se generan tareas de tests automatizados.

**Organization**: tareas agrupadas por user story. US1 (registro) y US2 (login) son
ambas P1; US1 es el incremento MVP mínimo y es entregable de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: a qué user story pertenece (US1, US2)
- Rutas de archivo exactas en cada descripción

## Path Conventions

App monolítica Next.js (App Router), un solo proyecto. Código bajo `src/` en la raíz
del repo. Grupos de ruta existentes `(auth)` y `(dashboard)` se reutilizan.

---

## Phase 1: Setup

**Purpose**: confirmar prerrequisitos y preparar el andamiaje de la feature.

- [x] T001 Verificar prerrequisitos y crear andamiaje: confirmar rama `002-auth-ui`, que Better Auth + plugin `organization` están activos en `src/lib/auth/index.ts` y `src/lib/auth/client.ts`, que los tokens de diseño existen en `src/app/globals.css` y `tailwind.config.ts`, y crear el directorio `src/components/auth/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: piezas compartidas por AMBAS user stories. Deben completarse antes de US1/US2.

**⚠️ CRITICAL**: ninguna user story puede terminar sin esta fase.

- [x] T002 [P] Crear componente de input compartido en `src/components/ui/input.tsx` usando los tokens de diseño (modo claro), con estado `disabled` y estilos de error, alineado con `src/components/ui/button.tsx` (FR-012).
- [x] T003 [P] Crear el guard del grupo `(auth)` en `src/app/(auth)/layout.tsx` como server component: si `auth.api.getSession()` devuelve sesión → `redirect("/inbox")`; si no, renderiza `children` (FR-009; cubre `/login` y `/register`).

**Checkpoint**: input compartido y guard de redirección listos → US1 y US2 pueden empezar.

---

## Phase 3: User Story 1 — Registro del dueño de agencia (Priority: P1) 🎯 MVP

**Goal**: un visitante anónimo crea cuenta + agencia, queda como dueño con organización
activa y aterriza en `/inbox` sin volver a iniciar sesión.

**Independent Test**: visitar `/register`, completar email nuevo + contraseña válida +
nombre de agencia, enviar, y verificar sesión iniciada, `organization` creada, `member`
con `role='owner'`, `session.activeOrganizationId` poblado y navegación a `/inbox`
(quickstart Flujo 1).

### Implementation for User Story 1

- [x] T004 [P] [US1] Crear helper de slug en `src/lib/auth/slug.ts`: normaliza el nombre (minúsculas, sin acentos, espacios→guiones) y añade sufijo aleatorio corto (nanoid) para garantizar unicidad del `organization.slug` (R3).
- [x] T005 [US1] Crear el formulario de registro (client component) en `src/components/auth/register-form.tsx`: campos email/password/agencyName con validación Zod por campo antes de enviar (FR-002); secuencia al enviar `authClient.signUp.email({ email, password, name })` → `authClient.organization.create({ name, slug })` (slug de T004) → asegurar organización activa con `authClient.organization.setActive()` si no quedó activa → `router.replace("/inbox")` (FR-003/FR-004); manejo de correo duplicado con mensaje claro conservando email y agencyName y limpiando password (FR-005); botón `disabled` mientras la operación está en vuelo (FR-013); área de error legible sin volcar errores técnicos crudos ni secretos (FR-014). Reutiliza `Input` (T002) y `Button`. Depende de: T002, T004.
- [x] T006 [US1] Crear la página de registro en `src/app/(auth)/register/page.tsx` que monta `RegisterForm` con la marca "Inmox" y los tokens de diseño (FR-012). Queda envuelta por el guard `(auth)` (T003). Depende de: T005, T003.

**Checkpoint**: US1 funcional e independientemente testeable (registro → `/inbox`). MVP entregable.

---

## Phase 4: User Story 2 — Inicio de sesión (Priority: P1)

**Goal**: un dueño con cuenta existente inicia sesión, su agencia queda activa y aterriza
en `/inbox`.

**Independent Test**: con una cuenta ya existente (creada por US1 o sembrada vía la API
de auth), visitar `/login`, introducir credenciales correctas y verificar navegación a
`/inbox` con organización activa resuelta; credenciales incorrectas → mensaje genérico
(quickstart Flujo 2).

### Implementation for User Story 2

- [x] T007 [P] [US2] Añadir `databaseHooks.session.create.before` en `src/lib/auth/index.ts`: antes de persistir una sesión con `activeOrganizationId` nulo, buscar la primera membresía del usuario en `member` (orden estable por `createdAt`) y fijar `activeOrganizationId` a `member.organizationId` (R1; habilita FR-007/FR-011 en login y en cualquier sesión nueva). No exponer secretos ni datos de otros tenants.
- [x] T008 [US2] Crear el formulario de login (client component) en `src/components/auth/login-form.tsx`: campos email/password; al enviar `authClient.signIn.email({ email, password })` → `router.replace("/inbox")` (FR-007); ante credenciales inválidas (correo inexistente o contraseña incorrecta) mostrar un único mensaje genérico "Correo o contraseña incorrectos" sin revelar si el correo existe (FR-008/SC-006); botón `disabled` en vuelo (FR-013); errores de red legibles. Reutiliza `Input` (T002) y `Button`. El flujo depende en runtime del hook T007. Depende de: T002, T007.
- [x] T009 [US2] Reemplazar el stub en `src/app/(auth)/login/page.tsx` para montar `LoginForm` con la marca "Inmox" y los tokens de diseño (FR-012). Queda envuelta por el guard `(auth)` (T003). Depende de: T008, T003.

**Checkpoint**: US1 y US2 funcionan de forma independiente; login resuelve organización activa.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: consistencia de marca, navegación y verificación final.

- [x] T010 [P] Corregir la marca en el sidebar del dashboard: "Hábitat" → "Inmox" en `src/app/(dashboard)/layout.tsx` (R7, consistencia de marca; cambio trivial fuera del alcance estricto de auth pero visible al usuario recién registrado).
- [x] T011 Añadir enlaces recíprocos de navegación entre `/login` y `/register` ("¿No tienes cuenta? Regístrate" / "¿Ya tienes cuenta? Inicia sesión") en `src/components/auth/login-form.tsx` y `src/components/auth/register-form.tsx`.
- [x] T012 Correr la puerta de calidad y dejarla en verde (Principio V): typecheck (`pnpm exec tsc --noEmit`), `pnpm lint`, `pnpm build`. Reportar resultados verbatim. → typecheck exit 0 · lint "No ESLint warnings or errors" · build exit 0.
- [x] T013 Verificación en navegador real con Playwright (quickstart Flujos 1–4). Hecho con un **script de Playwright** (no el MCP, que no estaba conectado en la sesión) contra una **Postgres embebida local** + la migración aplicada. Resultados: US1 5/5 (registro→/inbox, FR-009 ×2, validación por campo, correo duplicado) y US2 5/5 (login feliz→/inbox vía hook, contraseña incorrecta y correo inexistente con mismo mensaje genérico, enlaces recíprocos). DB confirma `member.role='owner'` y slug normalizado+sufijo. Capturas en `C:\tmp\pw\*.png`. **Pendiente de verificación humana en el deploy** (inmox-dev) tras aplicar la migración allí.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. BLOQUEA US1 y US2.
- **US1 (Phase 3)** y **US2 (Phase 4)**: dependen de Foundational. Pueden ir en paralelo (archivos mayormente distintos) o secuencial P1→P1 (US1 primero como MVP).
- **Polish (Phase 5)**: depende de las user stories deseadas completas.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. No depende de US2. Fija la organización activa de forma explícita (no necesita T007).
- **US2 (P1)**: tras Foundational. No depende de US1 (puede probarse con una cuenta sembrada). T007 es su mecanismo de organización activa.

### Within Each User Story

- US1: T004 (slug) → T005 (form) → T006 (page).
- US2: T007 (hook) ∥ T008 (form) → T009 (page).

### Parallel Opportunities

- Foundational: **T002 ∥ T003** (archivos distintos).
- US1: **T004 [P]** mientras se prepara la fase; T005 espera a T002+T004.
- US2: **T007 [P]** y **T008** son archivos distintos (config server vs. componente).
- Cross-story: tras Foundational, **US1 y US2 en paralelo** (distintos archivos; ambos tocan el grupo `(auth)` pero en páginas/forms separados).
- Polish: **T010 [P]** independiente.

---

## Parallel Example: Foundational + arranque de stories

```text
# Foundational en paralelo:
Task T002: "Crear src/components/ui/input.tsx con tokens de diseño"
Task T003: "Crear src/app/(auth)/layout.tsx (guard de redirección a /inbox)"

# Tras Foundational, dos devs en paralelo:
Dev A (US1): T004 → T005 → T006
Dev B (US2): T007 ∥ T008 → T009
```

---

## Implementation Strategy

### MVP First (solo US1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational) → 3. Phase 3 (US1).
4. **PARAR y VALIDAR**: registro de punta a punta hasta `/inbox` (quickstart Flujo 1).
5. Desplegar/demostrar si está listo.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 (registro) → validar → demo (MVP: ya se puede crear la primera agencia y dueño).
3. US2 (login) → validar → demo (acceso recurrente).
4. Polish (marca, enlaces, gate, verificación en navegador).

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- [Story] mapea cada tarea a su user story para trazabilidad.
- No se reporta "Hecho" sin T012 en verde; T013 se marca como verificación humana asistida (Principio V).
- Nunca imprimir contraseñas ni tokens en consola/logs/errores (FR-014, Principio I).
- Commit por tarea o grupo lógico; no commitear materiales de clase de `docs/`.
