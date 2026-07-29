# Implementation Plan: CRM Inmobiliario con WhatsApp

**Branch**: `001-realestate-whatsapp-crm` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-realestate-whatsapp-crm/spec.md`

## Summary

CRM multi-tenant para agencias inmobiliarias cuyo canal principal es WhatsApp,
para operaciones de **renta y venta**. Se entrega como una aplicación full-stack
**Next.js 15 (App Router) + TypeScript estricto**, con **PostgreSQL self-hosted**
vía **Drizzle ORM**, autenticación **self-hosted con Better Auth** (plugin
`organization` = multi-tenancy), almacenamiento de objetos en un servicio
**S3-compatible** detrás de la interfaz S3 estándar (Cloudflare R2 en el MVP,
portable a MinIO sin cambios de código), e integración con **WhatsApp Cloud API**
como Tech Provider propio (onboarding por Embedded Signup, webhooks idempotentes con
verificación de firma). Despliegue en **Coolify** (app + Postgres como servicios
separados). El alcance respeta el orden de prioridades del spec (P1 comunicación →
P2 dominio → P3 operación → P4 documentos/contratos) y **no** incluye generación de
contratos.

## Technical Context

**Language/Version**: TypeScript 5.x en modo estricto (`strict: true`,
`noUncheckedIndexedAccess: true`); Node.js 20 LTS (runtime de Next.js 15).

**Primary Dependencies**: Next.js 15 (App Router, React 19) · Tailwind CSS +
shadcn/ui (modo claro principal) · Drizzle ORM + drizzle-kit (migraciones
versionadas) · Better Auth + plugin `organization` · Zod (validación de todo input
externo) · nanoid (IDs con prefijo) · `@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner` (interfaz S3 estándar) · gestor de paquetes **pnpm**.

**Storage**: PostgreSQL self-hosted (contenedor separado en Coolify, vía
`DATABASE_URL`) para datos relacionales; almacenamiento de objetos S3-compatible
(Cloudflare R2 en MVP) para fotos de propiedades y documentos/contratos, accedido
solo por la interfaz S3 estándar.

**Testing**: Vitest (unitario + integración de capa de datos/servicios) y Playwright
(E2E de los flujos críticos por historia). Tests "donde apliquen" según Principio V;
los gates obligatorios son tipos + lint + build (ver Constitution Check).

**Target Platform**: Contenedor Linux (imagen Docker multi-stage, salida Next
`standalone`) desplegado en Coolify; clientes en navegadores modernos de escritorio
(la bandeja es una herramienta de trabajo de agencia).

**Project Type**: Aplicación web full-stack única (Next.js App Router: UI + Route
Handlers + Server Actions en un solo proyecto).

**Performance Goals**: un mensaje entrante aparece en la bandeja en < 2 s desde la
recepción del webhook (SC-002/003); listado de catálogo < 1 s para inventarios
típicos (cientos–miles de propiedades por agencia); alta de propiedad/candidato
fluida (< 1 min de interacción humana, SC-005).

**Constraints**: aislamiento estricto por `organization_id` en toda consulta de
dominio (Principio III, SC-004); secretos cifrados en reposo y nunca expuestos ni
registrados (Principio I, FR-006/SC-008); webhooks idempotentes (Principio IV,
FR-005); core self-hosted, almacenamiento de objetos portable a self-hosted
(Principio II); migraciones fuera del `docker build` (aplicadas como Pre-Deployment
Command en Coolify).

**Scale/Scope**: MVP para agencias pequeñas/medianas; del orden de decenas de
agentes por agencia y miles de propiedades/conversaciones por agencia; **un (1)**
número de WhatsApp por agencia en v1 (Assumptions del spec).

## Constitution Check

*GATE: debe pasar antes de la Fase 0 y re-evaluarse tras el diseño de la Fase 1.*
Evaluado contra la constitución **v1.2.0** (8 principios).

| # | Principio | Gate de cumplimiento en este plan | Estado |
|---|-----------|-----------------------------------|:------:|
| I | Seguridad de Datos Primero | Token de Meta cifrado AES-256-GCM en `meta_credentials` (`encrypted_token`, `token_iv`, `auth_tag`); clave de cifrado por env var, fuera del repo. Tokens/credenciales nunca se envían al cliente ni se registran (logging redacta secretos). | ✅ PASS |
| II | Soberanía / Self-Hosted | Auth (Better Auth) y PostgreSQL self-hosted en Coolify. Almacenamiento de objetos vía interfaz S3 estándar con endpoint/credenciales por env var → migrable a MinIO sin cambios de código (excepción explícita permitida por v1.2.0). | ✅ PASS |
| III | Multi-Tenancy Real | `organization_id` indexado en **toda** tabla de dominio; acceso a datos forzado por una capa que exige el scope de tenant; roles owner/agent vía plugin `organization` de Better Auth. | ✅ PASS |
| IV | Idempotencia en Integraciones Externas | Webhook de WhatsApp: verificación `X-Hub-Signature-256` antes de procesar + dedup por `message id` (constraint único). Reintentos de Meta no duplican mensajes. | ✅ PASS |
| V | Calidad Verificable Antes de "Hecho" | Gates obligatorios: `tsc --noEmit` (estricto), ESLint, `next build`; Vitest/Playwright donde apliquen. Lo no verificable se marca "pendiente de verificación humana". | ✅ PASS |
| VI | Specs Antes de Código | Spec clarificado 16/16 antes de este plan; el plan deriva del spec. | ✅ PASS |
| VII | Trazabilidad de Decisiones | Decisiones técnicas tomadas sin certeza se listan en [research.md](./research.md) bajo "Decisiones pendientes de verificación humana". | ✅ PASS |
| VIII | Foco Vertical Inmobiliario | Modelo de datos de dominio inmobiliario (propiedades, candidaturas, muestras, contratos); **sin** generación de contratos (FR-022); nada fuera de una agencia gestionando propiedades y clientes. | ✅ PASS |

**Resultado**: sin violaciones. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-realestate-whatsapp-crm/
├── plan.md              # Este archivo (/speckit-plan)
├── spec.md              # Especificación clarificada (16/16)
├── research.md          # Fase 0: decisiones técnicas + alternativas
├── data-model.md        # Fase 1: entidades, campos, relaciones, estados
├── quickstart.md        # Fase 1: setup local + deploy en Coolify
├── contracts/           # Fase 1: contratos de interfaz (webhook + API interna)
│   ├── README.md
│   ├── whatsapp-webhook.md
│   └── internal-api.md
└── checklists/
    └── requirements.md  # Checklist de calidad del spec (16/16)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/                     # login / aceptar invitación (Better Auth)
│   ├── (dashboard)/
│   │   ├── inbox/                  # P1 — bandeja unificada (layout 3 columnas)
│   │   ├── properties/             # P2 — catálogo (grid de tarjetas)
│   │   ├── candidacies/            # P2/P4 — pipeline de candidaturas + expediente
│   │   ├── showings/               # P3 — muestras/visitas
│   │   ├── team/                   # P3 — gestión de equipo (solo owner)
│   │   └── settings/whatsapp/      # P1 — onboarding Embedded Signup
│   └── api/
│       ├── health/route.ts         # GET healthcheck (verifica DB)
│       ├── auth/[...all]/route.ts  # handler de Better Auth
│       └── webhooks/whatsapp/route.ts  # GET verify + POST eventos (idempotente)
├── lib/
│   ├── auth/                       # config Better Auth + plugin organization
│   ├── db/                         # cliente Drizzle, schema/, helpers de tenant-scope
│   ├── meta/                       # cliente tipado WhatsApp Cloud API (transporte+tipos)
│   ├── storage/                    # wrapper S3 (put/get/presign) — interfaz estándar
│   ├── crypto/                     # AES-256-GCM (cifrar/descifrar token de Meta)
│   ├── realtime/                   # abstracción de tiempo real (polling MVP, websocket-ready) — DV-1
│   └── validation/                 # esquemas Zod compartidos
├── components/
│   ├── ui/                         # primitivos shadcn/ui
│   └── inbox/ · properties/ · candidacies/ · showings/   # componentes de dominio
└── server/                         # Server Actions / casos de uso por historia
drizzle/                            # migraciones versionadas (drizzle-kit)
docs/design/                        # HTML de referencia visual (NO se mergea)
Dockerfile                          # multi-stage, Next standalone
```

**Structure Decision**: proyecto único full-stack Next.js (App Router). El backend
vive en Route Handlers (`app/api/**`) y Server Actions (`src/server/**`); la lógica
de acceso a datos y el scope de tenant se concentran en `src/lib/db`. Esta estructura
evita un monorepo innecesario para un MVP de un solo despliegue, manteniendo
fronteras claras para las integraciones externas (`lib/meta`, `lib/storage`) que
exige el Principio II.

## Complexity Tracking

> No aplica: el Constitution Check no arrojó violaciones que justificar.
