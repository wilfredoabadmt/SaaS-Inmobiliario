# Quickstart — CRM Inmobiliario con WhatsApp

**Feature**: `001-realestate-whatsapp-crm` · **Date**: 2026-06-07

Guía para levantar el proyecto en local y desplegarlo en Coolify. Honra la
constitución v1.2.0 (core self-hosted; almacenamiento de objetos S3 portable).

## Prerrequisitos

- **Node.js 20 LTS** y **pnpm**.
- **PostgreSQL 16** (local o contenedor).
- Bucket **S3-compatible**: Cloudflare R2 (MVP) o MinIO (self-hosted). Cualquiera
  funciona con las mismas variables de entorno.
- App de **Meta** configurada como Tech Provider (Embedded Signup) para WhatsApp.
- **Docker** (para construir/desplegar la imagen).

## Variables de entorno (solo nombres — nunca subir valores al repo)

```bash
# App / Auth
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
APP_BASE_URL=

# Cifrado de secretos en reposo (AES-256-GCM, 32 bytes base64)
ENCRYPTION_KEY=

# Meta / WhatsApp Cloud API (Tech Provider propio)
META_APP_ID=
META_APP_SECRET=
META_CONFIG_ID=
META_SYSTEM_USER_TOKEN=
META_SOLUTION_PARTNER_ID=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_API_VERSION=

# Almacenamiento de objetos (interfaz S3 estándar; R2 en MVP, MinIO portable)
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=
```

> Migrar de R2 a MinIO self-hosted = cambiar únicamente las variables `S3_*`. Sin
> cambios de código (Principio II / v1.2.0).

## Setup local

```bash
pnpm install
pnpm db:migrate          # aplica migraciones versionadas (drizzle-kit)
pnpm dev                 # Next.js en modo desarrollo
```

Webhook en local: exponer `/api/webhooks/whatsapp` con un túnel (p. ej. para pruebas)
y registrar la URL + `META_WEBHOOK_VERIFY_TOKEN` en la app de Meta.

## Gates de calidad (Principio V — definición de "Hecho")

```bash
pnpm typecheck           # tsc --noEmit (strict + noUncheckedIndexedAccess)
pnpm lint                # ESLint
pnpm build               # next build (salida standalone)
pnpm test                # Vitest (unit/integración)
pnpm test:e2e            # Playwright (flujos críticos por historia)
```

Una tarea está "Hecha" solo si **typecheck + lint + build** pasan (y los tests donde
apliquen). Lo no verificable automáticamente se marca "pendiente de verificación
humana".

## Despliegue en Coolify

1. **Servicios separados** en un mismo proyecto Coolify:
   - `postgres` (servicio de base de datos) → expone `DATABASE_URL` por red interna.
   - `app` (esta aplicación) → consume `DATABASE_URL` interno + el resto de env vars.
2. **Imagen**: `Dockerfile` multi-stage con salida Next `standalone`.
3. **Migraciones**: configurar **Pre-Deployment Command** = `pnpm db:migrate`.
   **Nunca** correr migraciones dentro de `docker build`.
4. **Healthcheck**: `GET /api/health` (verifica DB). Coolify marca el contenedor
   healthy solo cuando responde `200`.
5. **Webhook de producción**: registrar `https://<dominio>/api/webhooks/whatsapp` en
   la app de Meta con el `META_WEBHOOK_VERIFY_TOKEN`.

## Verificación rápida del MVP (smoke test por historia)

- **P1**: conectar WhatsApp (Embedded Signup) → enviar mensaje desde un teléfono
  externo → aparece en la bandeja → responder → llega al teléfono.
- **P2**: crear propiedad (renta/venta) + subir foto → vincular una conversación a la
  propiedad → registrar candidatura.
- **P3**: invitar agente → iniciar sesión como agente → agendar muestra → recibir
  recordatorio.
- **P4**: subir documento de cliente → subir contrato → cambiar estado a *firmado*.

## Referencias de diseño

`docs/design/` contiene los HTML de referencia visual (bandeja y catálogo). Se
**replican** en Next + shadcn (acento ámbar para renta, teal para venta, bandeja de 3
columnas, grid de tarjetas, panel lateral propiedad+candidato). **No** se mergea el
HTML. Los tokens exactos (tipografía **Geist**, paletas teal/ámbar, radios, densidad)
ya se extrajeron de esas referencias en [design-tokens.md](./design-tokens.md) —
mapearlos al theme de Tailwind/shadcn.
