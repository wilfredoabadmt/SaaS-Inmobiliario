# Research — UI de autenticación (002-auth-ui)

Decisiones técnicas resueltas antes del diseño. No quedan `NEEDS CLARIFICATION`.

## R1 — Resolución de la organización activa (`activeOrganizationId`)

**Problema**: `getActiveContext()` (en `src/lib/auth/guards.ts`) exige
`session.activeOrganizationId`; si es `null`, devuelve `null` y el layout de
`(dashboard)` redirige a `/login`. Better Auth **no** rellena `activeOrganizationId`
automáticamente al iniciar sesión. Sin resolverlo, un usuario con credenciales
correctas entraría en bucle login → dashboard → login.

**Decisión**:
- **Login (y cualquier sesión nueva)**: añadir un hook server-side
  `databaseHooks.session.create.before` en `src/lib/auth/index.ts` que, antes de
  persistir la sesión, busque la **primera membresía** del usuario en `member` y fije
  `activeOrganizationId` a esa organización. Fuente única de verdad, sin carrera de
  cliente, idempotente.
- **Registro**: la sesión se crea en `signUp.email()` **antes** de existir la
  organización, así que el hook no encuentra membresía todavía. Por eso el flujo de
  registro fija la organización activa **explícitamente** tras crearla:
  `authClient.organization.create()` y, si no quedó activa, `organization.setActive()`.

**Racional**: cubre los dos caminos (alta nueva y retorno de usuario) con el menor
acoplamiento; el hook server-side es robusto frente a recargas y no depende de que el
cliente complete una segunda llamada. Satisface FR-007 y FR-011.

**Alternativas consideradas**:
- *Solo cliente* (`setActive` tras cada `signIn`): frágil ante recargas y depende de
  una segunda llamada que puede fallar; descartada como única solución.
- *Middleware de Next que resuelva el tenant*: no hay middleware en el proyecto y
  añadirlo introduce complejidad de runtime/edge innecesaria; descartada.
- *Persistir organización activa en `user` y leerla en cada request*: duplica estado
  que ya vive en `session.activeOrganizationId`; descartada.

**Pendiente de verificación humana**: confirmar en runtime si `organization.create`
ya deja la organización como activa en esta versión (1.6.14); si lo hace, la llamada
a `setActive` en registro es defensiva (no daña). Se verifica con el flujo de
quickstart.

## R2 — Rol del creador de la organización

**Decisión**: confiar en que el plugin `organization` de Better Auth asigna al creador
el rol `owner` en `member.role`. El guard `requireOwner()` compara exactamente contra
`"owner"`, y `getActiveContext()` trata cualquier otro valor como `agent`.

**Racional**: alinea el registro con la semántica owner/agent ya existente sin escribir
en `member` manualmente. La columna `member.role` tiene default `"member"` a nivel de
tabla, pero el alta vía el plugin escribe `"owner"` para el creador.

**Pendiente de verificación humana**: confirmar con el flujo de quickstart que tras el
registro, el onboarding de WhatsApp (que usa `requireOwner`) deja de devolver
"no autorizado / sin organización activa" (SC-005).

## R3 — Generación de `slug` de organización

**Problema**: `organization.slug` es `UNIQUE`. Dos agencias pueden tener el mismo
nombre visible (Edge Case del spec), así que el slug no puede derivarse solo del
nombre.

**Decisión**: generar el slug a partir del nombre normalizado (minúsculas, sin
acentos, espacios→guiones) **más un sufijo corto aleatorio** (nanoid) para garantizar
unicidad. Si la API expone un error de slug duplicado, reintentar con nuevo sufijo.

**Racional**: preserva legibilidad del slug sin colisiones entre tenants homónimos.
El nombre visible (`organization.name`) se guarda tal cual lo escribe el usuario.

**Alternativas**: slug = solo nombre (rompe ante homónimos); slug = solo nanoid
(ilegible). Descartadas.

## R4 — Política de error que no revela existencia de correo (FR-008 / SC-006)

**Decisión**: en login, ante cualquier fallo de credenciales (correo inexistente o
contraseña incorrecta) mostrar **un único mensaje genérico** ("Correo o contraseña
incorrectos"). No diferenciar los casos en la UI ni en el estado. En registro, el
único caso que sí se comunica es "correo ya registrado" (FR-005), porque ahí el
usuario necesita saberlo para ir a login; esto es una decisión de producto explícita y
no contradice FR-008 (que aplica a **login**).

**Racional**: evita enumeración de cuentas en el flujo de login, conforme al Principio
I. La distinción registro/login está alineada con el spec (FR-005 vs FR-008).

## R5 — Manejo de errores de red/servicio y doble-submit (FR-013, Edge Cases)

**Decisión**: cada formulario es un client component con estado `pending`; el botón se
deshabilita mientras la promesa de `authClient` está en vuelo (FR-013). Los errores se
capturan y se muestran en un área de mensaje legible, sin volcar el error técnico
crudo ni dejar pantalla en blanco. Errores de campo (formato de correo, contraseña
corta, nombre vacío) se validan con Zod en el cliente antes de llamar al SDK.

**Racional**: cumple FR-002, FR-013 y los Edge Cases de doble-submit y fallo de red
con una sola pieza de estado por formulario.

## R6 — Guard de redirección para usuarios ya autenticados (FR-009)

**Decisión**: añadir `src/app/(auth)/layout.tsx` como **server component** que llama a
`auth.api.getSession()` y, si hay sesión, hace `redirect("/inbox")`. Cubre login y
registro de una sola vez. El layout de `(dashboard)` ya cubre FR-010 (sin sesión →
`/login`) y se reutiliza sin cambios.

**Racional**: server-side evita parpadeo de contenido protegido y centraliza la regla.
Se prefiere a replicar el patrón cliente de `SessionRedirect` (que existe para la
landing pública por una razón distinta de SSR).

**Alternativas**: chequeo cliente por página (parpadeo, duplicación); middleware (no
existe en el proyecto). Descartadas.

## R7 — Branding "Inmox" (FR-012)

**Decisión**: las pantallas de auth muestran "Inmox" y usan los tokens de diseño
existentes (`accent`, `bg`, `text`, `border` definidos en `globals.css` /
`tailwind.config.ts`, modo claro). Se reemplaza el "Hábitat" del stub de login. El
rótulo "Hábitat" del sidebar de `(dashboard)/layout.tsx` se corrige también por
consistencia de marca (cambio trivial, exento por Principio VI), aunque cae fuera del
alcance estricto de "pantallas de auth"; se deja anotado para revisión.

**Racional**: FR-012 es explícito sobre la marca; arrastrar "Hábitat" en el dashboard
contradiría la identidad de Inmox a la vista del usuario recién registrado.

## R8 — Componentes de UI

**Decisión**: reutilizar `src/components/ui/button.tsx` (ya con variantes `cva` y
estado `disabled`). Crear `src/components/ui/input.tsx` con los mismos tokens (no
existe aún). Los formularios viven en `src/components/auth/` como client components y
las páginas (`page.tsx`) los montan.

**Racional**: mantiene la consistencia visual y evita HTML crudo; sigue el patrón de
componentes existente del proyecto.
