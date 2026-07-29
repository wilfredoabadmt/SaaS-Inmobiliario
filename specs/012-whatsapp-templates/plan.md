# Implementation Plan: Gestión de plantillas de WhatsApp (012-whatsapp-templates)

**Branch**: `012-whatsapp-templates` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-whatsapp-templates/spec.md`

## Summary

Convertir el registro local de plantillas (hoy solo metadata de plantillas *ya aprobadas*, sin estatus ni
sincronización) en una **sección de administración real** que habla directamente con la WhatsApp Business
Management API **por agencia**, reutilizando la conexión existente (`metaCredentials`: `wabaId` + token
cifrado). Cuatro bloques sobre la base existente (`template` + `lib/meta` + el envío de plantilla de la
bandeja):

1. **Cliente de gestión en `lib/meta`** (misma frontera de WhatsApp, sin frontera nueva): `createMessageTemplate`,
   `listMessageTemplates`, `deleteMessageTemplate`, `getTemplateAnalytics` y los helpers de **Resumable Upload**
   (`POST /{app_id}/uploads`) para la imagen de muestra del header. Todas tipadas, vía `graphRequest` con el
   **token de la agencia**, con mapeo de errores de Meta a mensajes legibles y degradación ante token inválido.
2. **Modelo + sincronización de estatus**: migración **aditiva** que extiende `template` (id de Meta, estatus,
   componentes JSON canónicos, razón de rechazo, calidad, `last_synced_at`) y añade `template_analytics` (caché
   diaria). El estatus se mantiene por **dos vías**: (a) webhook `message_template_status_update` —ruteado por
   `waba_id` (`entry.id`) porque **no trae `phone_number_id`**— idempotente; y (b) **pull bajo demanda**
   (`GET /{waba_id}/message_templates`) que reconcilia toda la lista.
3. **Sección de Plantillas (UI) + endpoints**: `/templates` lista con badges de estatus, builder práctico
   (categoría, idioma, header texto/imagen, body con variables `{{1}}` + ejemplos, footer, botones), acciones
   crear/enviar-a-revisión/eliminar/sincronizar (solo **owner**) y vista de **estadísticas** (enviados/
   entregados/leídos/clics + **costo real** vía Analytics API, cacheadas; "sin datos" degrada).
4. **Envío manual con variables desde la bandeja**: se extiende `POST /api/conversations/[id]/messages/template`
   para aceptar valores de variables, construir los `components` de Meta y renderizar el cuerpo en el hilo; solo
   plantillas **aprobadas** son seleccionables y se valida que no falten variables. Sigue siendo la vía válida
   fuera de la ventana de 24 h.

**Fuera de alcance (otra spec):** envíos **automáticos** — recordatorio de visita al cliente por WhatsApp,
re-enganche automático del agente al cerrarse la ventana de 24 h, y follow-ups. Esta feature deja las
plantillas aprobadas, con variables y enviables como **base** para esos automatismos.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), runtime Node.js.

**Primary Dependencies**: Next.js 15 (App Router) · Drizzle ORM + PostgreSQL · Better Auth (plugin
`organization`, roles owner/agent) · Zod. **Sin dependencias nuevas**: la WhatsApp Business Management API y la
Resumable Upload API se consumen por **fetch directo** reutilizando `graphRequest`/`MetaApiError` de
`src/lib/meta` (misma frontera que el envío/recepción de WhatsApp; no se crea frontera nueva porque las
plantillas son del propio canal WhatsApp).

**Storage**: PostgreSQL. Migración **aditiva** `0011_whatsapp_templates.sql`: extiende `template`
(`wa_template_id`, `status`, `rejected_reason`, `quality_rating`, `components` jsonb, `last_synced_at`) y crea
`template_analytics` (caché diaria por plantilla). Sin backfill destructivo; filas previas quedan
`status=null` (= "no sincronizada") hasta el primer Sync.

**Testing**: `pnpm typecheck` + `pnpm lint` + `pnpm build` (gate) y **self-test E2E de comportamiento**
conducido por el agente: crear plantilla desde la UI → PENDING → (Meta aprueba) → APPROVED por sync/webhook →
enviar con variables al número de prueba (Evolution) → llega en WhatsApp → stats reflejan envío/costo →
eliminar. La **aprobación** la decide Meta (minutos–24 h) → ese paso se marca pendiente de verificación
humana/Meta.

**Target Platform**: App Next.js en Coolify (inmox-dev), Postgres separado.

**Project Type**: Web app (route handlers `src/app/api/**` + componentes server/client + servicios
`src/server/**` + frontera `src/lib/meta`).

**Performance Goals**: lista de plantillas = 1 lectura local; Sync = 1–2 llamadas a Meta (paginado);
estadísticas servidas desde caché (refresh bajo demanda con TTL), 1 llamada a Meta por refresh. Escala de
agencia pequeña; sin objetivos de throughput especiales.

**Constraints**: multi-tenant por `organization_id` (todas las operaciones acotadas); token de WhatsApp
**nunca** al cliente ni a logs; webhook idempotente (Principio IV) y ruteo correcto del campo de plantillas;
toda llamada a Meta degrada con gracia (token inválido → `reconnect_required`; 5xx/datos faltantes → no rompe
UI). Escrituras de gestión restringidas a **owner**.

**Scale/Scope**: 1 tabla extendida + 1 tabla nueva; ~7 endpoints nuevos/extendidos + extensión del webhook;
~6 funciones nuevas en `lib/meta`; 1 sección nueva de UI (lista + builder + stats) + extensión del selector de
plantillas de la bandeja; 1 entrada de navegación.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Seguridad de Datos Primero (NO NEGOCIABLE)** — ✅ El token de WhatsApp se descifra solo server-side
  (`getSendingCredentials`/`open`), nunca se devuelve al cliente ni se loguea (se reusa el patrón existente).
  La definición de componentes y el contenido de plantillas no son secretos. Aislamiento por tenant en TODAS
  las operaciones (lista, crear, sync, eliminar, stats) vía `organization_id` + guards.
- **II. Soberanía / Self-Hosted** — ✅ El core (auth + Postgres) sigue self-hosted. La WhatsApp Business
  Management API es una integración externa **no-core**, aislada tras la frontera `src/lib/meta` (no se acopla
  el dominio a ella; degrada si falta token/Meta). No se introduce dependencia SaaS nueva.
- **III. Multi-Tenancy Real** — ✅ `organization_id` de primer nivel; `requireMember`/`requireOwner` en cada
  endpoint. Las plantillas pertenecen a la cuenta de WhatsApp Business de la **agencia** (no a un usuario).
- **IV. Idempotencia en Integraciones Externas** — ✅ El webhook `message_template_status_update` se procesa
  idempotente (es un *set* de estatus, no un incremento; comparar y aplicar último estado), ruteado por
  `waba_id`. El upsert de caché de analítica es por (plantilla, día). Crear/eliminar son acciones del owner
  (no reintentos de proveedor) pero el mapeo de errores evita registros fantasma.
- **V. Calidad Verificable Antes de "Hecho" (NO NEGOCIABLE)** — ✅ Gate técnico + self-test E2E conducido por
  el agente; la **aprobación de Meta** y la **App Review de producción** se marcan pendientes de verificación
  humana/Meta.
- **VI. Specs Antes de Código** — ✅ spec.md validado antes de este plan.
- **VII. Trazabilidad de Decisiones** — ✅ Decisiones DV-WT-1…12 en research.md; supuestos en spec.
- **VIII. Foco Vertical Inmobiliario** — ✅ Las plantillas son el instrumento para que la agencia reactive
  conversaciones fuera de 24 h y (en specs futuras) recuerde visitas y haga follow-ups a sus clientes; sirve
  directamente a una agencia inmobiliaria gestionando clientes por WhatsApp.

**Resultado: PASS, sin violaciones.** Complexity Tracking vacío. (Nota: la imagen de header vía Resumable
Upload añade pasos, pero es parte de la misma frontera de WhatsApp, no una integración nueva.)

## Project Structure

### Documentation (this feature)

```text
specs/012-whatsapp-templates/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones DV-WT-1…12
├── data-model.md        # Fase 1 — extensión de `template` + tabla `template_analytics` + modelo canónico
├── quickstart.md        # Fase 1 — suscripción del campo de webhook + permiso de gestión + self-test
├── contracts/
│   └── api.md           # Fase 1 — endpoints /api/templates/** + webhook + envío con variables
└── checklists/
    └── requirements.md  # Calidad del spec (ya creado)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── meta/
│   │   ├── index.ts                 # EXTENDER: createMessageTemplate, listMessageTemplates,
│   │   │                            #   deleteMessageTemplate, getTemplateAnalytics, uploadResumable(handle),
│   │   │                            #   buildTemplateSendComponents(values), tipos + mapeo de errores
│   │   └── templates.ts             # NUEVO: modelo canónico de componentes ↔ shape de Meta,
│   │                                #   validación de variables/ejemplos, render de preview/cuerpo
│   └── db/schema/domain.ts          # EXTENDER `template` + NUEVA tabla `template_analytics`
├── server/
│   ├── whatsapp/
│   │   ├── credentials.ts           # EXTENDER: getManagementCredentials(org) → { wabaId, token } (server-only)
│   │   └── templates.ts             # NUEVO: servicio de dominio — create/list/sync/delete/analytics
│   │                                #   (orquesta lib/meta + Drizzle, scoping por org, degradación)
│   └── inbox/
│       ├── ingest.ts                # EXTENDER: processTemplateStatusUpdate(orgId, value) idempotente
│       └── queries.ts               # EXTENDER: listTemplates devuelve estatus/componentes; solo aprobadas
│                                    #   para el selector de la bandeja
├── app/
│   ├── (dashboard)/templates/
│   │   ├── page.tsx                 # NUEVA sección: lista + estatus + acciones + stats (server component)
│   │   └── ...                      # componentes client: builder, badges, panel de stats, modal eliminar
│   └── api/
│       ├── templates/
│       │   ├── route.ts             # GET (member, lista con estatus) · POST (owner, crear+enviar a revisión)
│       │   ├── sync/route.ts        # POST (owner) → reconciliar estatus desde Meta
│       │   ├── upload-sample/route.ts # POST (owner) → handle de imagen para header (Resumable Upload)
│       │   ├── analytics/route.ts   # GET (member) → resumen agregado de la agencia (rango)
│       │   └── [id]/
│       │       ├── route.ts         # DELETE (owner) → borra en Meta + fila
│       │       └── analytics/route.ts # GET (member) → stats de UNA plantilla (rango, cacheadas)
│       ├── conversations/[id]/messages/template/route.ts # EXTENDER: acepta `variables`, construye components
│       └── webhooks/whatsapp/route.ts # EXTENDER: rutear field=message_template_status_update por entry.id (waba)
└── components/
    ├── templates/                   # NUEVO: builder, lista, badges de estatus, stats
    └── inbox/chat-thread.tsx        # EXTENDER: inputs de variables + preview al enviar plantilla

drizzle/
└── 0011_whatsapp_templates.sql      # migración aditiva (ALTER template + CREATE template_analytics) + journal idx 11
```

**Structure Decision**: Web app monorepo existente. **No** se crea frontera nueva: las plantillas son del
canal WhatsApp, así que el cliente de gestión vive en `src/lib/meta` (junto a envío/recepción/webhook), y el
servicio de dominio en `src/server/whatsapp/templates.ts` (junto a `credentials.ts`). Se **reutiliza**
`metaCredentials` (wabaId + token) y el webhook existente, extendiéndolo para un campo que hoy se descarta.
Esto contrasta con 011 (que sí abrió fronteras nuevas `lib/google`/`lib/mail`) porque allí eran proveedores
externos distintos; aquí es el mismo WhatsApp.

## Complexity Tracking

> Sin violaciones constitucionales que justificar. (Vacío.)

## Phases

- **Fase 0 — research.md**: decisiones DV-WT-1…12 (extender vs nueva tabla; text vs enum para estatus/categoría;
  reuso de `lib/meta` con token de agencia; modelo canónico de componentes y variables posicionales; header de
  imagen vía Resumable Upload; sincronización doble vía + ruteo del webhook por waba_id; analítica + costo y su
  degradación; permisos owner vs member; envío con variables; mapeo de errores legibles; App Review / aprobación
  fuera de control).
- **Fase 1 — data-model.md, contracts/api.md, quickstart.md**: esquema exacto y modelo canónico de componentes;
  contratos de los endpoints `/api/templates/**`, la extensión del webhook y el envío con variables; guía de
  setup (suscribir el campo `message_template_status_update` en el panel de Meta, verificar el permiso
  `whatsapp_business_management` sobre el WABA de prueba) + guion del self-test E2E (incluido el camino infeliz).
- **Fase 2 — tasks.md**: lo genera `/speckit-tasks` (no este comando).
