# Data Model — Sistema de diseño visual de Inmox (003)

**Feature**: `003-design-system` · **Date**: 2026-06-19

> Esta feature es de **capa de presentación**. **No** crea ni modifica tablas de base de
> datos. Lo que sigue son los **view models** (formas de datos que consumen los componentes)
> y los **fixtures de muestra**. Las entidades persistentes reales viven en
> `src/lib/db/schema/domain.ts` (feature 001) y no se tocan aquí.

## Tokens de diseño (no es una entidad de datos, es el sistema visual)

La capa de tokens es la "entidad" central de esta feature. Ver
[contracts/ui-contract.md](./contracts/ui-contract.md) para la tabla completa
(superficies, bordes, tinta, operación, estatus de propiedad/visita, etapas de pipeline,
chat, razones de match) y su mapeo a `globals.css` / `tailwind.config.ts`.

## View models (formas que consumen los componentes)

### Operación (enum visual)

`"venta" | "renta"`. Determina color (venta = teal/salvia, renta = bronce) y etiqueta.
Helpers en `lib/design/operation.ts`.

### Conversación (lista + hilo) — ya existe como `ConversationListItem`/`MessageItem`

Se reutiliza `src/lib/inbox/types.ts`. Campos relevantes para el diseño:
- `id`, `clientName | null`, `clientPhone`, `lastMessageAt`, `unread?` (badge no leído),
  `assignee?` (asesor), `stage?` (etapa), `primaryProperty?: { id, title, operationType }`.
- `MessageItem`: `id`, `direction: "inbound" | "outbound"`, `body`, `status: "sent" |
  "delivered" | "read" | "failed" | null`, `createdAt`, y un tipo extendido `kind?:
  "text" | "property"` para la ficha-burbuja de propiedad enviada por matching.

### Requisitos del cliente (view model de muestra — sin tabla aún)

Alimenta los chips del panel de matching. Forma:
- `operation: Operación`, `budgetLabel: string` (p. ej. "$15–18k/mes"), `zone: string`,
  `propertyType: string`, `bedrooms?: number`, `bathrooms?: number`.

### Match (view model de muestra — calculado en backend en el futuro)

Una propiedad rankeada para un cliente:
- `property: PropertyView`, `pct: number` (0–100), `reasons: { ok: boolean; label: string }[]`,
  `why: string` (explicación expandible).

### PropertyView (inventario)

- `id`, `title`, `operation: Operación`, `zone` (colonia/ciudad), `type` (depto/casa/…),
  `priceLabel: string`, `specs: string` (p. ej. "2 rec · 2 baños · 90 m²"),
  `status: "disponible" | "apartada" | "cerrada"`, `photoSeed: string` (para el gradiente).

### KPI (dashboard)

- `label: string`, `value: string`, `delta?: string`, `tone?: "default" | "warn"`.

### Actividad / Próxima visita (dashboard)

- Actividad: `actor: string`, `text: string`, `time: string`.
- Próxima visita: `dateBlock: { month: string; day: string }`, `client: string`,
  `property: string`, `time: string`, `agent: string`, `operation: Operación`.

### Visita (showings)

- `id`, `client`, `operation`, `property`, `dateLabel`, `time`, `agent`,
  `status: "agendada" | "realizada" | "cancelada" | "no_show"`.

### ClientRow (clientes)

- `id`, `name`, `phone`, `interest: string`, `operation: Operación`, `stage: PipelineStage`,
  `lastContact: string`.

### Lead / tarjeta de pipeline

- `id`, `client`, `property`, `operation`, `agent`, `stage: PipelineStage`.

### PipelineStage (enum de etapa)

`"nuevo" | "contactado" | "calificado" | "visita_agendada" | "documentacion" |
"en_negociacion" | "ganado"` (coincide con `candidacy.stage` del dominio, menos
`perdido`, que el tablero del handoff no muestra como columna). Cada etapa tiene un punto de
color (ver contrato).

## Fixtures de muestra

Centralizados en `src/lib/design/sample-data.ts`: arreglos estáticos de conversaciones (con
sus matches y requisitos), propiedades, KPIs, actividad, visitas, clientes y leads del
pipeline. Son **datos ficticios** para fidelidad visual; ninguna feature de producción
depende de ellos. Se sustituyen, vista por vista, por datos reales con scope de tenant en
features posteriores.

## Relaciones (a nivel de presentación)

```
Conversación 1—1 Cliente (nombre/teléfono)
Conversación 0..1—1 Propiedad principal (operación)
Cliente 1—1 Requisitos  → alimenta → Match[] (propiedad + pct + razones)
Match.property —→ PropertyView (mismo inventario que Propiedades)
Lead → Cliente + Propiedad + Etapa  (mismo universo que Pipeline/Clientes)
Visita → Cliente + Propiedad + Estado
```

Sin migraciones. Sin cambios en `domain.ts`.
