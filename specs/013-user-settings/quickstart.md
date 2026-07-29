# Quickstart / Self-test E2E — 013 Panel de configuración de usuario

Guía del self-test de comportamiento (Definición de Hecho REFORZADA). Se ejecuta tras
typecheck+lint+build en verde y deploy a inmox-dev. Marca como **pendiente de verificación
humana** solo lo no automatizable (recepción visual del correo real).

## Pre-requisitos

- Dos cuentas de prueba con email distinto (owner A ya existente; invitado B).
- SMTP configurado en Coolify (`SMTP_*`, `MAIL_FROM_NAME`) — si está OFF, el flujo de invitación
  degrada a enlace copiable (también verificable).
- R2/S3 configurado (ya en uso por fotos 007).
- `APP_BASE_URL` correcto (para el enlace de aceptación).

## Camino feliz

1. **Perfil**: como A, `/settings/account` → cambiar nombre + subir avatar (JPG/PNG/WebP < 5 MB) →
   guardar → el riel muestra la **foto** y el nuevo nombre sin recargar la app (SC-001).
2. **Seguridad**: `/settings/security` → cambiar contraseña (actual + nueva válida) → logout →
   re-login con la **nueva** contraseña funciona; la antigua falla (SC-002, SC-003).
3. **Organización**: como owner A, `/settings/organization` → cambiar nombre de la agencia + subir
   logo → persiste y se muestra.
4. **Equipo — invitar**: `/settings/team` → invitar al email de B como `agent` → se crea la
   invitación; si SMTP ON, llega el correo (pendiente de verificación humana = recepción visual);
   si OFF, aparece el **enlace copiable** (SC-007).
5. **Equipo — aceptar**: abrir el enlace como B (o desde el correo) → si no hay sesión, login/
   registro con el email B → "Unirme a {agencia}" → B queda como `agent` y **aparece en la lista**
   (SC-004).
6. **Cambiar rol**: A sube a B a `owner` → persiste; A baja a B a `agent` → persiste.
7. **Eliminar miembro**: A elimina a B → B desaparece de la lista y pierde acceso a la org.

## Camino infeliz (degradación sin colgarse)

- **Agente → 403**: como B (agent), invocar `POST /api/team/invitations`, `PATCH /api/team/
  members/[id]`, `DELETE …`, `PUT /api/organization` → todos **403** (SC-005).
- **Último owner**: como A (único owner), intentar `PATCH /api/team/members/[A]` a `agent` o
  `DELETE /api/team/members/[A]` → **409 last_owner**, bloqueado (SC-006).
- **Aislamiento de tenant**: con owner de la org X, pedir `PATCH/DELETE` sobre un `userId` o
  `token` de la org Y → **404** (no revela existencia) (SC-005).
- **Contraseña actual incorrecta**: en Seguridad, contraseña actual errónea → error legible, sin
  cambio.
- **Email ya miembro / ya invitado**: invitar al email de A (miembro) o reinvitar a B pendiente →
  **409** con mensaje legible, sin duplicar.
- **Imagen inválida**: subir un PDF o >5 MB → **422**; el avatar/logo previo no cambia.
- **Invitación inválida**: aceptar un token inexistente / expirado / ya aceptado / con un email de
  sesión distinto → estado legible, no crashea.
- **Email OFF / fallo SMTP**: la invitación se crea igual y se ofrece el enlace copiable.

## Gate técnico

```
pnpm typecheck && pnpm lint && pnpm build
```

(Verde obligatorio antes del self-test live.)

## Marca de pendiente de verificación humana

- Recepción y aspecto visual del correo de invitación real (entrega depende de SMTP/Gmail y del
  buzón del destinatario).
