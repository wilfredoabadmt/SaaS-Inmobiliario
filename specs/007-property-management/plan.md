# Implementation Plan: Administración de propiedades (inventario CRUD real)

**Branch**: `007-property-management` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-property-management/spec.md`

## Summary

Convertir `/properties` (hoy `SAMPLE_PROPERTIES` + botón cosmético) en el inventario **real** del
tenant: CRUD de propiedades, cambio rápido de estatus, **archivar/desarchivar** (soft-delete que
preserva historial), detalle con galería + **CRUD de fotos** (subida directa prefirmada a R2,
reordenar, principal, eliminar), **match inverso** propiedad→clientes (reusa el scoring determinista
de `src/server/matching/engine.ts` invirtiendo la entrada) y **edición manual** de
`client_requirements` (reusa `upsertRequirements` con `source="manual"`). Migración **aditiva**:
`property.archived_at`. Todo acotado por `organization_id` vía `requireMember()`.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Next.js 15 App Router

**Primary Dependencies**: Drizzle ORM + PostgreSQL · Better Auth (plugin `organization`) · Zod ·
AWS SDK S3 (`@aws-sdk/client-s3` + `s3-request-presigner`, R2) · Tailwind + shadcn/ui · lucide-react

**Storage**: PostgreSQL (tablas `property`, `property_photo`, `client_requirements`); objetos en R2
vía interfaz S3 (`src/lib/storage`)

**Testing**: typecheck (`pnpm typecheck`) + lint (`pnpm lint`) + build (`pnpm build`) **+ self-test
de comportamiento E2E** (Definición de Hecho reforzada): crear→foto→estatus→archivar→match inverso,
incluido camino infeliz (input inválido, propiedad sin foto, cero matches)

**Target Platform**: App web SSR en Coolify (app + Postgres separados; migración por Pre-Deployment)

**Project Type**: Web application (monolito Next.js: `src/app`, `src/components`, `src/lib`, `src/server`)

**Performance Goals**: Inventario interactivo de una agencia chica (2–10 usuarios, decenas–cientos de
propiedades). Listado < 1 s; subida de foto directa cliente→R2 sin pasar bytes por el server

**Constraints**: Multi-tenant estricto (toda query con `organization_id`); secretos nunca al cliente;
acceso a objetos solo vía interfaz S3 estándar; migración aditiva no destructiva

**Scale/Scope**: ~9 endpoints nuevos, 1 columna nueva (`archived_at`), reuso de schema existente, UI
en `/properties` (formulario + detalle/galería + match inverso) y mini-editor de requisitos del cliente

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en esta feature |
|---|---|
| **I. Seguridad de datos** | Sin secretos al cliente. La subida usa **URL prefirmada** de duración corta; el server solo firma, no expone credenciales S3. Todas las queries con `organization_id`. |
| **II. Soberanía / Self-Hosted** | Objetos solo vía `src/lib/storage` (interfaz S3 estándar, portable a MinIO). Auth + Postgres self-hosted intactos. Sin APIs propietarias no-S3. |
| **III. Multi-Tenancy real** | `organization_id` es parámetro de primer nivel en cada endpoint (vía `requireMember()`) y en cada `where`. Ninguna operación cruza tenant; propiedad de otra org → "no encontrada". |
| **IV. Idempotencia** | No hay nuevos webhooks entrantes. La confirmación de foto es idempotente por `storageKey`/id. (El tap de botones sigue siendo de 006.) |
| **V. Calidad verificable** | "Hecho" = typecheck+lint+build **+ self-test E2E**; lo no verificable (juicio visual) se marca pendiente humano. |
| **VI. Specs antes de código** | spec.md aprobada; este plan deriva de ella. |
| **VII. Trazabilidad** | Decisiones DV en research.md; supuestos en spec.md (Assumptions). |
| **VIII. Foco inmobiliario** | Es el núcleo del CRM inmobiliario: gestión de inventario de propiedades y su match con clientes. No genera contratos/documentos. |

**Resultado**: PASA. Sin violaciones → Complexity Tracking vacío.

## Project Structure

### Documentation (this feature)

```text
specs/007-property-management/
├── plan.md              # Este archivo
├── research.md          # Fase 0 (decisiones DV)
├── data-model.md        # Fase 1 (esquema + archived_at)
├── quickstart.md        # Fase 1 (cómo verificar / self-test)
├── contracts/
│   └── property-management.md   # Fase 1 (contratos de endpoints)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (dashboard)/properties/
│   │   ├── page.tsx                      # MOD: query real scoped (sin SAMPLE_PROPERTIES)
│   │   └── property-detail-sheet.tsx     # NUEVO: detalle + galería + fotos + match inverso (client)
│   └── api/
│       └── properties/
│           ├── route.ts                  # NUEVO: POST crear · GET listar (opcional)
│           └── [id]/
│               ├── route.ts              # NUEVO: GET detalle · PATCH editar
│               ├── archive/route.ts      # NUEVO: POST archivar/desarchivar
│               ├── status/route.ts       # NUEVO: PATCH estatus rápido
│               ├── photos/route.ts       # NUEVO: POST firmar subida · (POST confirmar)
│               ├── photos/[photoId]/route.ts  # NUEVO: PATCH (orden/principal) · DELETE
│               └── matching-clients/route.ts  # NUEVO: GET match inverso
│   └── api/clients/[id]/requirements/route.ts # NUEVO: PUT upsert manual de requisitos
├── server/
│   ├── properties/
│   │   ├── service.ts                    # NUEVO: create/update/archive/status/getDetail (scoped)
│   │   ├── photos.ts                     # MOD: + listPhotos, addPhoto, reorder, deletePhoto, signUpload
│   │   └── queries.ts                    # NUEVO: listProperties(orgId, filters) → PropertyView[] real
│   ├── matching/
│   │   ├── engine.ts                     # MOD: extraer scoreProperty + matchClientsForProperty (inverso)
│   │   └── queries.ts                    # MOD/uso: getMatchingClients(orgId, propertyId)
│   └── requirements/
│       └── service.ts                    # REUSO: upsertRequirements(..., "manual")
├── components/properties/
│   ├── properties-client.tsx             # MOD: abrir detalle, "Nueva propiedad" funcional, filtro archivadas
│   ├── property-form.tsx                 # NUEVO: form crear/editar (Zod en cliente + server)
│   ├── property-photos-editor.tsx        # NUEVO: subir/reordenar/principal/eliminar
│   └── matching-clients-panel.tsx        # NUEVO: lista de clientes que matchean
└── lib/
    ├── db/schema/domain.ts               # MOD: property.archivedAt (aditivo) + índice
    └── properties/schemas.ts             # NUEVO: Zod compartido (create/update/photo/requirements)

drizzle/                                  # NUEVO: migración aditiva archived_at
```

**Structure Decision**: Monolito Next.js existente. Dominio en `src/server/properties` (servicio con
scope de tenant), frontera S3 en `src/lib/storage` (sin tocar), reuso del engine de matching y del
servicio de requisitos. El detalle se implementa como **hoja/sheet** dentro de `/properties` (no ruta
nueva) para "desplegar la tarjeta" sin recargar; el formulario de alta/edición vive en la misma
pantalla. Validación Zod compartida cliente/servidor en `src/lib/properties/schemas.ts`.

## Complexity Tracking

> Sin violaciones constitucionales. No aplica.
