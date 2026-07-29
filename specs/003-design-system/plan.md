# Implementation Plan: Sistema de diseño visual de Inmox

**Branch**: `003-design-system` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-design-system/spec.md`

## Summary

Establecer el **sistema de diseño visual** de Inmox y rediseñar la UI autenticada para que
coincida con fidelidad con el prototipo de alta fidelidad de `design_handoff_inmox/` (fuente
de verdad). El trabajo es de **capa de presentación**: (1) reemplazar la capa de tokens
actual por la **paleta papel cálida** del handoff conservando los nombres de token y
añadiendo roles nuevos (estatus de propiedad/visita, etapas de pipeline, chat, razones de
match); (2) convertir el shell en un **riel de iconos de 66px** con las 7 vistas navegables;
(3) reconstruir la **bandeja de 3 columnas** con el panel de **matching en vivo**
(preservando el wiring funcional existente, sin cambiar contratos de API); y (4) crear las
vistas Dashboard, Propiedades, Pipeline, Visitas, Clientes y Configuración alimentadas por
**fixtures de muestra** centralizados, listas para que features posteriores sustituyan los
fixtures por datos reales.

Enfoque técnico (ver research.md):
- **Tokens** (D1, D2): reescribir valores en `globals.css` `:root` y extender
  `tailwind.config.ts`; mantener el paquete `geist` y añadir suavizado/tracking.
- **Shell** (D4, D5): riel de 66px en `(dashboard)/layout.tsx` + `sidebar-nav.tsx`; crear
  las rutas faltantes de las 7 vistas.
- **Bandeja** (US3): rehacer `inbox-client.tsx` y `chat-thread.tsx` a la maqueta del
  handoff; añadir el panel de matching; **conservar** la carga de mensajes y el envío de
  texto/plantilla (FR-030).
- **Datos de muestra** (D3): `src/lib/design/sample-data.ts` alimenta las vistas sin backend
  y el panel de matching.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`),
Next.js 15.1 (App Router), React 19.

**Primary Dependencies**: Tailwind 3 (theme extendido con tokens propios),
`tailwindcss-animate` (pulse de online/matching), `lucide-react` (iconografía), paquete
`geist` (fuente variable, ya cargada), `cva`/`cn` para variantes, shadcn/ui (modo claro).

**Storage**: N/A para esta feature. **No** crea ni modifica esquema de base de datos. La
bandeja consume las APIs existentes; el resto de vistas usa fixtures en memoria.

**Testing**: typecheck + lint + build como puerta mínima (Principio V). Verificación visual
de fidelidad contra el handoff (comparación lado a lado) y de no-regresión de la bandeja
marcada como **verificación humana asistida** (Playwright sobre el navegador local).

**Target Platform**: Web (navegador moderno de escritorio), Coolify; **solo modo claro**;
español (México). Desktop-first, mínimo ~1100px de ancho útil (D4).

**Project Type**: Web app monolítica (Next.js App Router, single project).

**Performance Goals**: Interacción fluida de herramienta de trabajo; animaciones `pulse`
suaves (~1.8–2.2s). Sin objetivos de throughput.

**Constraints**: Fidelidad ≥95% al handoff (SC-001); 100% de los valores nombrados con
token equivalente (SC-002); operación/estatus distinguibles sin depender solo del color
(FR-029); cero regresiones funcionales en la bandeja (FR-030/SC-005); no introducir hex
sueltos fuera de la capa de tokens (FR-006).

**Scale/Scope**: 8 vistas (Inicio, Bandeja, Propiedades, Clientes, Pipeline, Visitas,
Configuración + shell/riel); 1 capa de tokens reescrita; ~1 módulo de fixtures; rediseño de
2 componentes de bandeja + 1 panel de matching nuevo.

## Constitution Check

*GATE: pasa antes de Fase 0; se re-evalúa tras Fase 1.*

| Principio | Aplica | Cumplimiento en esta feature |
|-----------|--------|------------------------------|
| I. Seguridad de Datos Primero | Indirecto | Feature de presentación; no maneja secretos ni los imprime. Los fixtures son datos ficticios, no datos reales de tenant. La bandeja conserva su acceso ya scoped. |
| II. Soberanía / Self-Hosted | Sí | Se mantiene Geist self-hosted (paquete `geist`); **no** se añade dependencia externa (Google Fonts) ni SaaS de terceros. |
| III. Multi-Tenancy Real | Sí (preservado) | El rediseño no altera el scope de tenant existente; las vistas con fixtures se cablearán a queries con `organization_id` en su feature funcional. No se añade query sin scope. |
| IV. Idempotencia | No | Sin webhooks ni eventos externos en esta feature. |
| V. Calidad Verificable | Sí | "Hecho" = typecheck + lint + build en verde; fidelidad visual y no-regresión marcadas como verificación humana asistida. |
| VI. Specs Antes de Código | Sí | spec.md aprobado precede a este plan; el código sigue a tasks. |
| VII. Trazabilidad | Sí | Decisiones D1–D7 en research.md; supuestos (fixtures, desktop-first, rutas) explícitos. |
| VIII. Foco Vertical Inmobiliario | Sí | Todas las vistas sirven a la agencia inmobiliaria (bandeja, inventario, pipeline de prospectos, visitas/muestras, clientes). El diferenciador (matching propiedad↔cliente) es núcleo del dominio. |

**Resultado**: PASS. Sin violaciones que requieran Complexity Tracking.

**Re-evaluación post-Fase 1**: PASS — el diseño (tokens + componentes de presentación +
fixtures) no introduce acoplamientos a terceros, no toca el esquema ni el scope de tenant, y
mantiene el foco inmobiliario. Sin cambios respecto al check inicial.

## Project Structure

### Documentation (this feature)

```text
specs/003-design-system/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones D1–D7
├── data-model.md        # Fase 1: entidades de presentación (view models, sin esquema)
├── quickstart.md        # Fase 1: cómo verificar fidelidad y no-regresión
├── contracts/
│   └── ui-contract.md   # Fase 1: tokens, shell y contrato visual de cada vista
├── checklists/
│   └── requirements.md  # (ya existe) calidad del spec
└── tasks.md             # Fase 2: lo genera /speckit-tasks (NO aquí)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── globals.css                  # MODIFICA: :root con paleta papel + roles nuevos; suavizado/tracking
│   ├── layout.tsx                   # SIN CAMBIOS de lógica (Geist ya cargado); posible ajuste de body class
│   └── (dashboard)/
│       ├── layout.tsx               # MODIFICA: sidebar w-60 → riel de iconos 66px
│       ├── page.tsx                 # NUEVO: Inicio/Dashboard (KPIs + SLA + actividad/visitas)
│       ├── inbox/page.tsx           # MODIFICA: pasa templates + fixture de matching al cliente
│       ├── properties/page.tsx      # NUEVO: inventario (tarjetas/tabla + filtros)
│       ├── clients/page.tsx         # NUEVO: directorio de clientes (tabla + búsqueda)
│       ├── pipeline/page.tsx        # NUEVO: Kanban de 7 columnas
│       ├── showings/page.tsx        # NUEVO: visitas (lista + estado)
│       └── settings/page.tsx        # NUEVO: estado base "en construcción"
├── components/
│   ├── layout/
│   │   └── sidebar-nav.tsx          # MODIFICA: formato riel (icono + tooltip), 7 vistas, punto online
│   ├── inbox/
│   │   ├── inbox-client.tsx         # REDISEÑA: 3 columnas a fidelidad del handoff
│   │   ├── chat-thread.tsx          # REDISEÑA: header/franja 24h/burbujas/recibos/composer
│   │   └── matching-panel.tsx       # NUEVO: panel de matching en vivo (US3)
│   ├── properties/
│   │   ├── property-card.tsx        # NUEVO: tarjeta de propiedad
│   │   ├── property-table.tsx       # NUEVO: tabla de propiedades
│   │   └── property-thumb.tsx       # NUEVO: gradiente placeholder + ícono home (D6)
│   ├── dashboard/
│   │   ├── kpi-card.tsx             # NUEVO
│   │   └── sla-banner.tsx          # NUEVO
│   ├── pipeline/
│   │   └── pipeline-board.tsx       # NUEVO: Kanban + tarjeta + mover etapa (clamp)
│   └── ui/
│       ├── badge.tsx               # NUEVO/REUSA: chips de operación/estatus/etapa (cva)
│       ├── button.tsx              # SIN CAMBIOS funcionales (revisar tokens)
│       └── input.tsx               # SIN CAMBIOS funcionales (revisar tokens)
└── lib/
    ├── design/
    │   ├── operation.ts            # NUEVO: helpers de operación (label/clases venta·renta)
    │   ├── status.ts               # NUEVO: helpers de estatus de propiedad/visita y etapa
    │   └── sample-data.ts          # NUEVO: fixtures de muestra (D3) para vistas sin backend
    └── inbox/
        └── types.ts                # MODIFICA si hace falta: tipos de matching/requisitos
```

**Structure Decision**: Web app monolítica de Next.js (App Router), un solo proyecto. La
feature concentra el cambio en (a) la capa de tokens (`globals.css` + `tailwind.config.ts`),
(b) el shell de `(dashboard)`, (c) los componentes de cada vista bajo `src/components/*`, y
(d) un módulo de fixtures bajo `src/lib/design/`. La bandeja conserva sus contratos de API y
su abstracción de tiempo real (`lib/realtime`). **No se toca** el esquema de base de datos,
la autenticación ni la lógica de webhooks/WhatsApp.

## Decisiones de alcance y trazabilidad (Principio VII)

- **Fuente de verdad**: `design_handoff_inmox/` gana sobre `001/design-tokens.md` (histórico)
  ante cualquier discrepancia. Los tokens de 001 (teal `#0d9488`, ámbar `#d99a08`) quedan
  **deprecados** y se sustituyen por teal/salvia `#126b60` y bronce `#9a6a1a`.
- **Fixtures de muestra**: las vistas sin backend (Dashboard, Propiedades, Pipeline,
  Visitas, Clientes) y el panel de matching se alimentan de `lib/design/sample-data.ts`; es
  presentación, no datos reales. Cada feature funcional posterior reemplaza el fixture por
  queries con scope de tenant.
- **Requisitos del cliente y ranking de matching**: NO se modela ni calcula aquí; el panel
  muestra datos de muestra y deja el slot listo (feature posterior P1 funcional).
- **Responsividad móvil**: fuera de alcance; diseño desktop-first ~1100px+ (D4). Se nota como
  pendiente.
- **Reconciliación de rutas del riel**: los destinos del riel se alinean con las 7 vistas del
  handoff; los nombres definitivos se fijan en `contracts/ui-contract.md`.

## Complexity Tracking

No aplica: la Constitution Check pasa sin violaciones.
