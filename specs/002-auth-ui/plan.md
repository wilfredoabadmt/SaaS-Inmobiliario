# Implementation Plan: UI de autenticación (registro e inicio de sesión)

**Branch**: `002-auth-ui` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-auth-ui/spec.md`

## Summary

Construir las pantallas públicas de **registro** e **inicio de sesión** que hoy
faltan y bloquean todo el uso de Inmox. El backend de auth ya existe (Better Auth
self-hosted, email+contraseña, plugin `organization`). El trabajo es de **capa de
interfaz + flujo de sesión**: dos formularios cliente que consumen `authClient`, un
guard server-side que redirige usuarios autenticados fuera de las pantallas de auth,
y la pieza técnica central — garantizar que `session.activeOrganizationId` quede
resuelto tras registrarse **y** tras iniciar sesión, porque sin él
`getActiveContext()` devuelve `null` y el dashboard rebota a `/login` en bucle.

Enfoque técnico:
- **Registro**: `authClient.signUp.email()` → `authClient.organization.create()`
  (el creador queda como `owner`) → fijar esa organización como activa → redirigir a
  `/inbox`.
- **Login**: `authClient.signIn.email()`; la organización activa se resuelve por un
  `databaseHooks.session.create.before` server-side que rellena `activeOrganizationId`
  con la primera membresía del usuario. Cubre también el caso de sesiones nuevas de
  usuarios ya existentes.
- **Guards de navegación**: layout server-side del grupo `(auth)` que redirige a
  `/inbox` si ya hay sesión (FR-009); el layout `(dashboard)` ya redirige a `/login`
  si no hay contexto (FR-010), se reutiliza tal cual.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`),
Next.js 15.1 (App Router), React 19.

**Primary Dependencies**: Better Auth 1.6.14 (`emailAndPassword` + plugin
`organization`), Drizzle ORM, Zod 3, Tailwind 3 + tokens de diseño propios, `cva`
(class-variance-authority) para variantes de UI.

**Storage**: PostgreSQL self-hosted (tablas de Better Auth ya migradas: `user`,
`session`, `account`, `organization`, `member`, `invitation`). Esta feature **no
modifica el esquema**.

**Testing**: typecheck (`tsc`/`next build`) + lint (`next lint`) como puerta mínima
(Principio V). Verificación de flujo en navegador real con Playwright MCP (registro,
login, redirecciones, errores) marcada como verificación humana asistida.

**Target Platform**: Web (navegador moderno), desplegado en Coolify; modo claro.

**Project Type**: Web app monolítica (Next.js App Router, single project).

**Performance Goals**: SC-001 registro a panel < 2 min; SC-002 login en ≤ 3 pasos.
Sin objetivos de throughput (flujo interactivo de baja frecuencia).

**Constraints**: No exponer si un correo existe (FR-008/SC-006); no secretos en
errores/logs (FR-014, Principio I); deshabilitar envío en vuelo (FR-013); español;
reutilizar tokens de diseño (FR-012).

**Scale/Scope**: 2 pantallas nuevas (registro + login real), 1 layout de grupo,
1 componente `Input`, 1 ajuste server-side de resolución de organización activa.
Una organización activa por sesión (v1).

## Constitution Check

*GATE: pasa antes de Fase 0; se re-evalúa tras Fase 1.*

| Principio | Aplica | Cumplimiento en esta feature |
|-----------|--------|------------------------------|
| I. Seguridad de Datos Primero | Sí | Mensajes de error genéricos (FR-008); nunca se revela existencia de correo ni se imprime contraseña/token (FR-014). No se loggean credenciales. |
| II. Soberanía / Self-Hosted | Sí | Auth y BD ya self-hosted; esta feature solo consume `authClient`/`auth.api`. No introduce dependencias SaaS. |
| III. Multi-Tenancy Real | Sí (central) | El registro crea la organización (tenant) y la membresía `owner`; `activeOrganizationId` se resuelve para que todo acceso posterior opere con scope de tenant. No se añade query sin scope. |
| IV. Idempotencia | No directamente | No hay webhooks ni eventos externos en esta feature. (El doble-submit se mitiga por UX, FR-013, no es idempotencia de integración.) |
| V. Calidad Verificable | Sí | "Hecho" = typecheck + lint + build en verde; flujo en navegador marcado como verificación humana. |
| VI. Specs Antes de Código | Sí | spec.md aprobado precede a este plan; el código sigue a tasks. |
| VII. Trazabilidad | Sí | Decisiones bajo incertidumbre → research.md (resolución de org activa, slug, política de branding). |
| VIII. Foco Vertical Inmobiliario | Sí | El registro crea una **agencia inmobiliaria** (organización) y a su **dueño**; es el onboarding que habilita propiedades/clientes/WhatsApp. Sirve directamente al dominio. |

**Resultado**: PASS. Sin violaciones que requieran Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-ui/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones técnicas resueltas
├── data-model.md        # Fase 1: entidades consumidas (sin cambios de esquema)
├── quickstart.md        # Fase 1: cómo probar el flujo de punta a punta
├── contracts/
│   └── auth-ui.md       # Fase 1: contrato de pantallas, llamadas SDK y guards
├── checklists/
│   └── requirements.md  # (ya existe) calidad del spec
└── tasks.md             # Fase 2: lo genera /speckit-tasks (NO aquí)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx          # NUEVO: redirige a /inbox si ya hay sesión (FR-009)
│   │   ├── login/page.tsx      # REEMPLAZA stub: formulario de login real (US2)
│   │   └── register/page.tsx   # NUEVO: formulario de registro del dueño (US1)
│   └── (dashboard)/
│       └── layout.tsx          # SIN CAMBIOS de lógica (ya redirige a /login, FR-010)
├── components/
│   ├── auth/
│   │   ├── login-form.tsx      # NUEVO: client component, usa authClient.signIn
│   │   └── register-form.tsx   # NUEVO: client component, signUp + organization.create
│   └── ui/
│       ├── button.tsx          # SIN CAMBIOS (se reutiliza)
│       └── input.tsx           # NUEVO: input con tokens de diseño
└── lib/
    └── auth/
        ├── index.ts            # MODIFICA: añade databaseHooks para activeOrganizationId
        └── client.ts           # SIN CAMBIOS (ya expone organizationClient)
```

**Structure Decision**: Web app monolítica de Next.js (App Router), un solo proyecto.
Se reutilizan los grupos de rutas existentes `(auth)` y `(dashboard)`. La feature
añade un layout de grupo, dos páginas, dos formularios cliente y un componente `Input`,
y modifica `src/lib/auth/index.ts` para la resolución de organización activa. **No se
toca el esquema de base de datos** ni la lógica de dominio (inbox, WhatsApp).

## Decisiones de alcance y trazabilidad (Principio VII)

- **Branding "Hábitat" → "Inmox"**: el stub de `login` y el sidebar de
  `(dashboard)/layout.tsx` dicen "Hábitat". FR-012 exige "Inmox" en las **pantallas de
  auth**; se corrige ahí (en alcance). El rótulo del sidebar del dashboard queda
  **fuera del alcance estricto** de esta feature, pero se marca como corrección de
  consistencia recomendada (cambio trivial sin comportamiento nuevo, exento por
  Principio VI) — ver research.md.
- **Sin recuperación de contraseña ni verificación de correo** en v1 (Assumptions del
  spec): no se construyen aquí.

## Complexity Tracking

No aplica: la Constitution Check pasa sin violaciones.
