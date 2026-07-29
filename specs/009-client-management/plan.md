# Implementation Plan: Gestión de contactos vinculada a la bandeja

**Branch**: `009-client-management` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-client-management/spec.md`

## Summary

Volver **real** el módulo de contactos (hoy `/clients` con `SAMPLE_CLIENTS`, cosmético): listar desde BD
con scope de tenant, **crear** y **editar** contactos a mano, mostrar un **badge del canal de origen**
sobre el avatar y dar un atajo **"Enviar mensaje"** a la bandeja. Reusa la entidad de dominio existente
`client`. Añade una columna **aditiva** `client.channel` (`text`, no enum, para extensibilidad
WhatsApp→Instagram/Messenger) con backfill `'whatsapp'`. Completa el **auto-alta** que ya existe en
`src/server/inbox/ingest.ts`: registra el canal de origen y **enriquece sin sobrescribir** lo editado a
mano. El botón "Enviar mensaje" **no reimplementa reglas de canal**: resuelve (get-or-create) la
conversación del contacto y hace deep-link a `/inbox?c=<conversationId>`; **la bandeja** —única dueña de
la ventana 24h— decide texto libre vs. plantilla. Todo acotado por `organization_id` vía
`requireMember()` (owner+agent). ~5 endpoints nuevos bajo `/api/clients`, 1 columna nueva, deep-link en la
bandeja. **Cierre = self-test E2E en vivo** (inbound del número de prueba → contacto aparece con canal
WhatsApp; crear contacto manual → "Enviar mensaje" → bandeja exige plantilla fuera de ventana) + camino
infeliz.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Next.js 15 App Router

**Primary Dependencies**: Drizzle ORM + PostgreSQL · Better Auth (plugin `organization`, roles
owner/agent) · Zod en todo input externo · Tailwind + shadcn/ui · lucide-react · `src/lib/meta`
(WhatsApp Cloud API, reuso de ventana 24h + envío de plantilla)

**Storage**: PostgreSQL. Tabla existente `client` + columna aditiva `channel`. Sin almacenamiento de
objetos nuevo (sin R2 en esta feature).

**Testing**: typecheck (`pnpm typecheck`) + lint (`pnpm lint`) + build (`pnpm build`) **+ self-test de
COMPORTAMIENTO E2E** (Definición de Hecho REFORZADA, ver constitución V y CLAUDE.md): esta feature toca
**bandeja / WhatsApp / auto-alta / envío saliente**, así que el cierre exige conducir yo el flujo real con
el skill `whatsapp-ai-agent-selftest` (número de prueba Evolution, allowlist) + camino infeliz.

**Target Platform**: App web SSR en Coolify (app + Postgres separados; migración por Pre-Deployment
Command; healthcheck `/api/health`)

**Project Type**: Web application (monolito Next.js: `src/app`, `src/components`, `src/lib`, `src/server`)

**Performance Goals**: Directorio interactivo de agencia chica (2–10 usuarios, decenas–cientos de
contactos). Listado < 1 s. Auto-alta en el webhook sin agregar latencia perceptible (la inserción ya
ocurría; solo se añade el `channel` y el enriquecimiento).

**Constraints**: Multi-tenant estricto (toda query con `organization_id`); secretos nunca al cliente;
auto-alta idempotente (UNIQUE `client_org_phone_uq` + `message.wa_message_id`); migración **aditiva** no
destructiva; la lógica de ventana 24h/plantilla NO se duplica (vive en la bandeja).

**Scale/Scope**: ~5 endpoints nuevos (`POST/GET /api/clients`, `GET/PATCH /api/clients/[id]`,
`POST /api/clients/[id]/conversation`), 1 columna nueva (`client.channel`), deep-link `?c=` en la
bandeja, UI real en `/clients` (lista + form crear/editar + badge + acción "Enviar mensaje").

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en esta feature |
|---|---|
| **I. Seguridad de datos** | Ningún secreto al cliente. El teléfono es PII de tenant, nunca cruza org. Todas las queries con `organization_id` (vía `requireMember()`). El deep-link expone solo un `conversationId` ya scoped. |
| **II. Soberanía / Self-Hosted** | Sin nuevas dependencias externas ni almacenamiento de objetos. Auth + Postgres self-hosted intactos. WhatsApp sigue aislado tras `src/lib/meta`. |
| **III. Multi-Tenancy real** | `organization_id` es parámetro de primer nivel en cada endpoint y `where`. Contacto/conversación de otra org → "no encontrado". La unicidad de teléfono es **por organización** (`client_org_phone_uq`). |
| **IV. Idempotencia** | No hay webhook nuevo. El auto-alta reusa la dedup existente (UNIQUE org+phone, `message.wa_message_id`). El enriquecimiento pasa de `onConflictDoNothing` a `onConflictDoUpdate` **idempotente** (completar vacíos / subir canal manual→real; reejecutar no cambia el resultado). |
| **V. Calidad verificable** | "Hecho" = typecheck+lint+build **+ self-test E2E** que conduzco yo (toca bandeja/WhatsApp). Lo no verificable por mí (juicio visual del badge) se marca pendiente humano. |
| **VI. Specs antes de código** | spec.md escrita y validada; este plan deriva de ella. |
| **VII. Trazabilidad** | Decisiones DV-CM-1…7 en research.md; supuestos en spec.md (Assumptions / Out of Scope). |
| **VIII. Foco inmobiliario** | Los "contactos" son los clientes (prospectos a rentar/comprar) de la agencia: núcleo del CRM. No genera contratos/documentos. |

**Resultado**: PASA. Sin violaciones → Complexity Tracking vacío.

## Project Structure

### Documentation (this feature)

```text
specs/009-client-management/
├── plan.md              # Este archivo
├── research.md          # Fase 0 (decisiones DV-CM-1…7)
├── data-model.md        # Fase 1 (columna aditiva client.channel + enriquecimiento)
├── quickstart.md        # Fase 1 (cómo verificar / self-test E2E)
├── contracts/
│   └── client-management.md   # Fase 1 (contratos de endpoints)
├── checklists/
│   └── requirements.md  # Calidad de la spec (ya generado)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (dashboard)/
│   │   ├── clients/
│   │   │   └── page.tsx                 # MOD: query real scoped (sin SAMPLE_CLIENTS) → listClients
│   │   └── inbox/
│   │       └── page.tsx                 # MOD: leer searchParams `?c=` → initialConversationId
│   └── api/
│       └── clients/
│           ├── route.ts                 # NUEVO: POST crear · GET listar (opcional)
│           └── [id]/
│               ├── route.ts             # NUEVO: GET detalle · PATCH editar (nombre/teléfono/email/notas)
│               ├── conversation/route.ts# NUEVO: POST get-or-create conversación → { conversationId }
│               └── requirements/route.ts# EXISTE (007) — sin cambios
├── server/
│   ├── clients/
│   │   ├── service.ts                   # NUEVO: createClient/updateClient/getClientDetail (scoped + unicidad)
│   │   └── queries.ts                   # NUEVO: listClients(orgId) → ClientListItem[] (con canal + última actividad)
│   └── inbox/
│       ├── conversations.ts             # NUEVO: getOrCreateConversation compartido (extraído de ingest.ts)
│       └── ingest.ts                    # MOD: setear channel='whatsapp' + enriquecer (no pisar); usar helper compartido
├── components/
│   ├── clients/
│   │   ├── clients-client.tsx           # MOD: datos reales, badge de canal, botón "Enviar mensaje", "Nuevo contacto"
│   │   ├── client-form.tsx              # NUEVO: form crear/editar (Zod cliente+server)
│   │   └── channel-badge.tsx            # NUEVO: overlay de canal sobre el avatar (WhatsApp/IG/Messenger/manual)
│   └── inbox/
│       └── inbox-client.tsx             # MOD: aceptar initialConversationId y preseleccionarlo
└── lib/
    ├── db/schema/domain.ts              # MOD: client.channel (text, aditivo) + (opcional) índice
    ├── clients/
    │   ├── schemas.ts                   # NUEVO: Zod compartido (create/update)
    │   └── types.ts                     # NUEVO: ClientListItem, Channel
    └── inbox/types.ts                   # MOD (opcional): exponer clientId si hace falta

drizzle/                                 # NUEVO: migración aditiva ADD COLUMN client.channel DEFAULT 'whatsapp'
```

**Structure Decision**: Monolito Next.js existente. Dominio de contactos en `src/server/clients`
(servicio con scope de tenant + queries), espejando `src/server/properties` de 007. El **alta/edición**
se hace con un form en `/clients` (hoja/modal, sin ruta nueva). La lógica de **conversación** se
**centraliza**: se extrae `getOrCreateConversation` de `ingest.ts` a `src/server/inbox/conversations.ts`
y la usan tanto el ingest como el nuevo endpoint `POST /api/clients/[id]/conversation`, evitando duplicar
y divergir. El **deep-link** a la bandeja es por `conversationId` (la bandeja ya tiene la lista; solo
añade leer `?c=` y preseleccionar). Validación Zod compartida cliente/servidor en
`src/lib/clients/schemas.ts`. La frontera `src/lib/meta` (ventana 24h, plantillas) **no se toca**: la
bandeja sigue siendo la única dueña de las reglas de canal.

## Complexity Tracking

> Sin violaciones constitucionales. No aplica.
