# Quickstart — Probar la UI de autenticación (002-auth-ui)

Cómo verificar el flujo de punta a punta. La puerta mínima de "Hecho" (Principio V) es
**typecheck + lint + build** en verde; la verificación de comportamiento en navegador
se hace con Playwright MCP y se marca como verificación humana asistida.

## Requisitos previos
- Base de datos con las tablas de Better Auth migradas (`user`, `session`,
  `organization`, `member`, ...).
- Variables de entorno válidas (`.env`): `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `APP_BASE_URL`. (Las de Meta/S3 no afectan a este flujo.)
- App corriendo: `pnpm dev` (o el deploy en Coolify).

## Puerta de calidad (correr siempre)
```bash
pnpm exec tsc --noEmit     # o el typecheck del proyecto
pnpm lint
pnpm build
```
Los tres en verde antes de reportar "Hecho".

## Flujo 1 — Registro del dueño (US1)
1. Visitar `/register` sin sesión.
2. Introducir un correo **nuevo**, una contraseña válida (≥ 8) y un nombre de agencia.
3. Enviar. **Esperado**:
   - Se crea la cuenta y la agencia; el usuario queda como dueño.
   - La sesión queda con `activeOrganizationId` poblado.
   - Redirige a `/inbox` sin pedir login de nuevo.
4. Verificar en BD (opcional): existe `user`, existe `organization`, existe `member`
   con `role = 'owner'`, y `session.activeOrganizationId` apunta a esa organización.

### Casos de error de registro
- Correo ya registrado → mensaje "Ese correo ya está registrado"; permanece en
  pantalla, conserva email y nombre de agencia, limpia contraseña.
- Campos vacíos / contraseña corta / correo mal formado → mensaje por campo, no envía.

## Flujo 2 — Login (US2)
1. Cerrar sesión. Visitar `/login`.
2. Introducir credenciales correctas de la cuenta creada arriba.
3. Enviar. **Esperado**: inicia sesión, organización activa resuelta, redirige a
   `/inbox`.

### Casos de error de login
- Contraseña incorrecta **o** correo inexistente → mismo mensaje genérico "Correo o
  contraseña incorrectos" (no revela si el correo existe).

## Flujo 3 — Redirecciones (FR-009 / FR-010)
- Con sesión activa, visitar `/login` o `/register` → redirige a `/inbox`.
- Sin sesión, visitar `/inbox` (o cualquier ruta del panel) → redirige a `/login`.
- Tras cerrar sesión, volver a `/inbox` → redirige a `/login`.

## Flujo 4 — Verificación cruzada con WhatsApp (SC-005)
Tras registrarse, abrir el onboarding de WhatsApp (`/settings/whatsapp`). **Esperado**:
ya **no** devuelve "no autorizado / sin organización activa", porque la sesión tiene
organización activa y el usuario es `owner` (confirma R1 + R2).

## Verificación en navegador (Playwright MCP)
Recorrer con un navegador real: registro feliz → redirección a /inbox → logout → login
feliz → intento de credenciales malas (mensaje genérico) → acceso directo a /inbox sin
sesión (rebote a /login). Tomar capturas. Marcar el resultado como **verificación
humana asistida** en el PR (Principio V): lo no cubierto por typecheck/lint/build no se
reporta como verde automático.

## Checklist de marca y seguridad
- [ ] Las pantallas de auth muestran "Inmox" (no "Hábitat") — FR-012.
- [ ] Ningún mensaje revela si un correo existe (login) — FR-008 / SC-006.
- [ ] No aparecen contraseñas ni tokens en consola/logs — FR-014.
- [ ] El botón de envío se deshabilita mientras la operación está en curso — FR-013.
