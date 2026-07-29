# Implementation Plan: Pipeline de ventas real

**Branch**: `010-sales-pipeline` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-sales-pipeline/spec.md`

## Summary

Volver **real** el pipeline de ventas (hoy `/pipeline` con `SAMPLE_LEADS`, cosmético: etapas fijas en
`lib/design/status.ts`, tarjetas que solo se mueven con chevrons, no se abren, "agente" de muestra)
conectándolo a la entidad de dominio existente **`candidacy`** (cliente + propiedad + etapa + agente, ya
scoped por `organization_id`), que hoy solo crea `showings/service.ts` al agendar una visita. Sobre ese
cimiento, las 4 mejoras del dueño:

1. **Etapas configurables por agencia**: las etapas dejan de ser un `pgEnum` global y pasan a una tabla
   nueva **`pipeline_stage`** (org-scoped, ordenada). `candidacy.stage` (enum) migra a **`candidacy.stage_id`**
   (FK a `pipeline_stage`). Se **siembran las 8 etapas actuales por organización** (backfill que mapea cada
   valor de enum vivo a su fila sembrada). Anclas con rol fijo (`kind` = `won`/`lost`/`visit`) no
   eliminables; el resto editable. Solo `requireOwner` configura.
2. **Drag-and-drop** entre columnas (reusa el cambio de etapa que ya persiste), conservando los chevrons
   como fallback accesible; arreglo del scroll (tablero horizontal + columnas con scroll vertical cómodo).
3. **Panel de detalle** al abrir una tarjeta (drawer): cliente (nombre, teléfono, badge de canal de 009),
   requisitos (004), propiedad + foto principal (007), resumen de últimos mensajes, **"Abrir en bandeja"**
   = deep-link a `/inbox?c=<conversationId>` reusando `getOrCreateConversation` (009) — la bandeja sigue
   siendo la única dueña de las reglas de canal/ventana 24h.
4. **Asignación real** reusando `candidacy.assignedAgentId` (FK `user`), validando que el destino sea
   `member` de la org activa.

Blast radius mínimo confirmado por código: el único literal de etapa en server es `showings/service.ts`
(`stage:"visita_agendada"`), que pasa a resolver la etapa ancla `visit` de la org; el "dashboard de
cierres" **hoy es cosmético** (`SAMPLE_KPIS`), así que las anclas `won`/`lost` se preservan a futuro sin
romper nada vivo. ~7 endpoints bajo `/api/pipeline`. **Cierre = self-test E2E de comportamiento** (crear →
mover/persistir → configurar etapas como owner → abrir panel → asignar) + camino infeliz.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Next.js 15 App Router,
React 19

**Primary Dependencies**: Drizzle ORM + PostgreSQL · Better Auth (plugin `organization`, roles
owner/agent — `requireMember`/`requireOwner`) · Zod en todo input externo · Tailwind + shadcn/ui ·
lucide-react · **`@dnd-kit/core`** (nueva dependencia **solo cliente** para el drag-and-drop accesible;
pointer + keyboard sensors). Reuso de `getOrCreateConversation` (009) y `lib/realtime` (polling, DV-1) para
el refresco del tablero.

**Storage**: PostgreSQL. **Tabla nueva `pipeline_stage`** (org-scoped). **`candidacy` modificada**:
`stage` (enum) → `stage_id` (FK `pipeline_stage`); `property_id` pasa a **nullable**. Migración con
**backfill** (sembrar etapas por org + mapear candidacies vivos). Sin almacenamiento de objetos nuevo (la
foto del panel reusa la URL prefirmada de R2 de 007).

**Testing**: typecheck (`pnpm typecheck`) + lint (`pnpm lint`) + build (`pnpm build`) **+ self-test de
COMPORTAMIENTO E2E** (Definición de Hecho REFORZADA). Esta feature es **mayormente UI/datos** (no cambia el
cerebro del agente ni el envío saliente), así que el self-test es **conductual de UI**: conducir el tablero
real (crear/mover/persistir/configurar/abrir/asignar) y verificar que **"Abrir en bandeja" cae en la
conversación correcta**. El juicio visual fino (estética del drawer, fluidez del arrastre) se marca
**pendiente de verificación humana**.

**Target Platform**: App web SSR en Coolify (app + Postgres separados; **migración por Pre-Deployment
Command**; healthcheck `/api/health`). OJO migración con backfill de datos vivos.

**Project Type**: Web application (monolito Next.js: `src/app`, `src/components`, `src/lib`, `src/server`)

**Performance Goals**: Tablero interactivo de agencia chica (2–10 usuarios, decenas–cientos de tratos).
Carga del tablero < 1 s. Mover/asignar con feedback óptimo inmediato (optimistic UI) + persistencia
confirmada. Refresco entre miembros por polling (no instantáneo, aceptable).

**Constraints**: Multi-tenant estricto (toda query con `organization_id` vía `requireMember`/`requireOwner`);
**migración aditiva-con-backfill no destructiva** (preserva la etapa de cada candidacy vivo); anclas
`won`/`lost`/`visit` indelebles; no se duplica la lógica de canal/ventana 24h (vive en la bandeja); el
borrado de etapa no deja tratos huérfanos (FK `restrict` + guard de app).

**Scale/Scope**: 1 tabla nueva (`pipeline_stage`) + 2 cambios a `candidacy` (`stage_id`, `property_id`
nullable) + 1 migración con backfill. ~7 endpoints bajo `/api/pipeline`. UI real en `/pipeline` (tablero
DnD + drawer de detalle + modo "Configurar etapas"). 1 dependencia cliente nueva (`@dnd-kit/core`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en esta feature |
|---|---|
| **I. Seguridad de datos** | Sin secretos al cliente. `pipeline_stage` y `candidacy` siempre con `organization_id` en el `where`; trato/etapa de otra org → "no encontrado". El panel expone solo datos ya scoped (cliente, requisitos, propiedad, `conversationId`). La foto usa URL prefirmada efímera (007). |
| **II. Soberanía / Self-Hosted** | Sin nuevos servicios externos. `@dnd-kit/core` es una librería **cliente** (no toca el core auth/BD). Postgres self-hosted intacto; WhatsApp sigue tras `src/lib/meta` (solo deep-link, no se llama). |
| **III. Multi-Tenancy real** | `pipeline_stage` es **por organización** (no global): cada agencia tiene su embudo. `organization_id` es parámetro de primer nivel en cada endpoint, `where` y unique index. La asignación valida pertenencia a la org (`member`). |
| **IV. Idempotencia** | Sin webhook nuevo. Crear trato es idempotente (unique `(org,client,property)`; parcial `(org,client) where property null`). La siembra de etapas por org es idempotente (no re-siembra si ya existen). Mover/asignar son PATCH idempotentes (poner el mismo valor no cambia nada). |
| **V. Calidad verificable** | "Hecho" = typecheck+lint+build **+ self-test E2E conductual** que conduzco yo. Lo no verificable por mí (estética/fluidez del arrastre, juicio visual) se marca pendiente humano. |
| **VI. Specs antes de código** | spec.md escrita y validada (checklist en verde); este plan deriva de ella. |
| **VII. Trazabilidad** | Decisiones **DV-SP-1…7** en research.md; supuestos/anclas en spec.md (Assumptions / Out of Scope). El riesgo de la migración con backfill queda documentado en research + data-model. |
| **VIII. Foco inmobiliario** | El pipeline de **tratos** (cliente↔propiedad por etapa) es la operación comercial central de una agencia (P3 del CRM). No genera contratos. |

**Resultado**: PASA. Sin violaciones constitucionales → Complexity Tracking vacío. La complejidad notable
(migración enum→tabla con backfill) **no es una violación**: es la única forma de hacer las etapas
configurables por tenant (un enum global no puede ser per-org); se mitiga con migración aditiva
seed-then-map que preserva los datos vivos (ver research DV-SP-1).

## Project Structure

### Documentation (this feature)

```text
specs/010-sales-pipeline/
├── plan.md              # Este archivo
├── research.md          # Fase 0 (decisiones DV-SP-1…7)
├── data-model.md        # Fase 1 (pipeline_stage + candidacy.stage_id/property_id + migración backfill)
├── quickstart.md        # Fase 1 (cómo verificar / self-test E2E + camino infeliz)
├── contracts/
│   └── pipeline.md      # Fase 1 (contratos de los ~7 endpoints)
├── checklists/
│   └── requirements.md  # Calidad de la spec (ya generado)
└── tasks.md             # Fase 2 (/speckit-tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (dashboard)/
│   │   └── pipeline/
│   │       └── page.tsx                    # MOD: server component → carga tablero real (sin SAMPLE_LEADS)
│   └── api/
│       └── pipeline/
│           ├── route.ts                    # NUEVO: GET tablero (etapas ordenadas + tratos agrupados)
│           ├── deals/
│           │   ├── route.ts                # NUEVO: POST crear trato (clientId, propertyId?)
│           │   └── [id]/
│           │       └── route.ts            # NUEVO: GET detalle (panel) · PATCH mover etapa / asignar agente
│           └── stages/
│               ├── route.ts                # NUEVO: GET listar (config) · POST crear etapa (owner)
│               ├── order/route.ts          # NUEVO: PUT reordenar atómico (owner)
│               └── [id]/route.ts           # NUEVO: PATCH renombrar/reordenar · DELETE (owner, guard anclas+tratos)
├── server/
│   ├── pipeline/
│   │   ├── board.ts                        # NUEVO: getBoard(orgId) → etapas + tratos (omite client/property archivados)
│   │   ├── deals.ts                        # NUEVO: createDeal/moveDeal/assignDeal/getDealDetail (scoped + validaciones)
│   │   ├── stages.ts                       # NUEVO: list/create/rename/reorder/delete + seedDefaultStages(orgId) + resolveAnchorStage(orgId,kind)
│   │   └── queries.ts                      # NUEVO: lecturas del panel (cliente+requisitos+propiedad+últimos mensajes)
│   └── showings/
│       └── service.ts                      # MOD: ensureCandidacy usa resolveAnchorStage(org,'visit') en vez de "visita_agendada"
├── components/
│   └── pipeline/
│       ├── pipeline-board.tsx              # MOD: DnD (@dnd-kit), datos reales, click→drawer, chevrons fallback, scroll
│       ├── deal-card.tsx                   # NUEVO: tarjeta (cliente/propiedad/operación/agente) draggable
│       ├── deal-drawer.tsx                 # NUEVO: panel lateral de detalle + "Abrir en bandeja" + ficha propiedad
│       ├── assign-agent.tsx               # NUEVO: selector de miembro de la org (o "Sin asignar")
│       └── stage-config.tsx                # NUEVO: modo "Configurar etapas" (owner): renombrar/agregar/eliminar/reordenar
└── lib/
    ├── db/schema/domain.ts                 # MOD: tabla pipeline_stage; candidacy.stageId (FK) + property_id nullable
    └── pipeline/
        ├── schemas.ts                      # NUEVO: Zod compartido (crear trato, mover/asignar, CRUD etapa)
        └── types.ts                        # NUEVO: BoardData, StageView, DealCard, StageKind

drizzle/                                    # NUEVO: migración pipeline_stage + backfill (seed-then-map) + candidacy.stage_id / property_id nullable
```

**Structure Decision**: Monolito Next.js existente. Dominio nuevo en `src/server/pipeline` (espejo de
`src/server/clients` de 009 y `src/server/properties` de 007): `board.ts` (lectura del tablero), `deals.ts`
(mutaciones del trato), `stages.ts` (config + helpers `seedDefaultStages`/`resolveAnchorStage`). Endpoints
bajo `/api/pipeline` con dos guards: `requireMember` para tablero/mover/asignar/crear-trato; `requireOwner`
para el CRUD de etapas. El **deep-link** a la bandeja reusa `getOrCreateConversation` (009) y la bandeja ya
lee `?c=`. El **DnD** se monta sobre el `pipeline-board.tsx` actual con `@dnd-kit/core` (droppable por
columna, draggable por tarjeta; activation constraint para distinguir **clic→drawer** de **arrastre→mover**),
manteniendo los chevrons. La **automatización de visitas** se desacopla del literal de etapa vía
`resolveAnchorStage(org,'visit')`. `lib/design/status.ts` se conserva como **semilla visual** (colores/labels
por defecto al sembrar `pipeline_stage`).

## Complexity Tracking

> Sin violaciones constitucionales. No aplica.
>
> Nota de complejidad (no-violación, documentada en research DV-SP-1): la migración `candidacy.stage`
> enum→`stage_id` FK con backfill seed-then-map es la parte de mayor riesgo (muta una columna con datos
> vivos). Es necesaria —un enum de Postgres es global y no puede ser per-tenant— y se mitiga con una
> migración aditiva que siembra las etapas por org y mapea cada candidacy existente a su etapa sembrada
> antes de exigir `NOT NULL`, preservando el estado actual de cada trato.
