---
description: "Task list — Sistema de diseño visual de Inmox (003)"
---

# Tasks: Sistema de diseño visual de Inmox

**Input**: Design documents from `specs/003-design-system/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md

**Tests**: NO se generan tareas de test automatizado (no solicitados; el proyecto verifica
con typecheck + lint + build y verificación visual humana, Principio V). La feature es de
capa de presentación.

**Organization**: Tareas agrupadas por historia de usuario (US1–US8) en orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: A qué historia pertenece (US1–US8)

## Path Conventions

Web app monolítica Next.js (App Router), single project: `src/app/`, `src/components/`,
`src/lib/`. Fuente de verdad visual: `design_handoff_inmox/` + `contracts/ui-contract.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar la base sin romper lo existente.

- [x] T001 Confirmar dependencias presentes (`lucide-react`, `geist`, `tailwindcss-animate`, `clsx`/`tailwind-merge` para `cn`) en `package.json`; instalar las que falten con pnpm
- [x] T002 Leer y fijar `design_handoff_inmox/Inmox.dc.html` como referencia abierta para comparar fidelidad durante toda la implementación (no portar su runtime)

**Checkpoint**: Toolchain de UI lista.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Capa de tokens + helpers + fuente. BLOQUEA todas las historias porque todo el
rediseño consume estos tokens.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [x] T003 Reescribir `src/app/globals.css` `:root` con la paleta papel cálida y TODOS los roles nuevos (superficies, bordes, tinta, operación venta/renta, chat, ventana 24h, razones de match, radios) según `contracts/ui-contract.md` §1; añadir `-webkit-font-smoothing:antialiased; letter-spacing:-.006em` y el fondo `#f6f4ef` al body
- [x] T004 Extender `tailwind.config.ts` con las claves de color nuevas/ajustadas (`bg.sunken`, `ink.{strong,faintest}`, `venta.{dot,border}`, `renta.{dot,border}`, divisor, fill-avatar) y radios (`rail`), mapeando a las CSS vars de T003
- [x] T005 [P] Crear `src/lib/design/operation.ts`: tipo `Operation`, etiqueta es-MX, y helpers de clases para chip/punto/avatar/barra por operación (venta teal / renta bronce)
- [x] T006 [P] Crear `src/lib/design/status.ts`: enums y helpers de estatus de propiedad (disponible/apartada/cerrada), estatus de visita (agendada/realizada/cancelada/no_show) y etapa de pipeline (7) con su punto de color
- [x] T007 [P] Crear `src/components/ui/badge.tsx`: componente de chip con variantes `cva` (operación, estatus-propiedad, estatus-visita, etapa, neutro) que SIEMPRE muestra texto + color (FR-029)
- [x] T008 Revisar `src/components/ui/button.tsx` y `src/components/ui/input.tsx` para que usen los tokens nuevos (botón primario = tinta `#211d16`; foco con borde control) sin cambiar su API
- [x] T009 Verificar que la app autenticada existente (inbox/auth) sigue compilando con los tokens nuevos: `pnpm typecheck` en verde

**Checkpoint**: Capa de tokens viva; cualquier pantalla puede construirse sobre ella.

---

## Phase 3: User Story 1 — Sistema de design tokens único (Priority: P1) 🎯 MVP (base)

**Goal**: Capa de tokens única que cubre el 100% de los valores del handoff y se consume sin
hex sueltos.

**Independent Test**: Inspeccionar `globals.css` + `tailwind.config.ts` y confirmar un token
equivalente por cada valor nombrado del handoff; una pantalla los consume sin literales.

- [x] T010 [US1] Auditar la cobertura de tokens contra `contracts/ui-contract.md` §1: marcar en una tabla que cada valor del handoff (superficies, bordes, tinta, operación, estatus propiedad/visita, etapas, chat, razones) tiene token; cerrar huecos en `globals.css`/`tailwind.config.ts`
- [x] T011 [P] [US1] Crear `src/lib/design/typography.ts` (o utilidades CSS) con la escala tipográfica del handoff (h1 24/600, sección 19/600, KPI 30/600, %match 18/600, nombre 15/600, micro-label 11/700) para reutilizar en todas las vistas
- [x] T012 [P] [US1] Añadir a `globals.css`/`tailwind.config.ts` las sombras nombradas (reposo, hover, burbuja, ficha) y la animación `pulse` (1→.3→1, ~2s) como utilidad reutilizable
- [x] T013 [US1] Deprecar `specs/001-realestate-whatsapp-crm/design-tokens.md` con una nota de cabecera apuntando al handoff como fuente de verdad (sin borrar el histórico)

**Checkpoint**: Todos los tokens del handoff existen y son consumibles (SC-002).

---

## Phase 4: User Story 2 — App shell con riel de iconos (Priority: P1)

**Goal**: Marco de app con riel de 66px y las 7 vistas navegables.

**Independent Test**: Cargar la app autenticada; el riel de 66px aparece fijo con logo,
botones, configuración+avatar abajo, estado activo correcto y navegación funcional.

- [x] T014 [US2] Rediseñar `src/components/layout/sidebar-nav.tsx` a formato riel: 6 botones 44×44 (radio 12) con ícono Lucide + tooltip, estado activo (tarjeta blanca + borde + sombra) vía `usePathname()`, rutas: `/` Inicio, `/inbox` Bandeja (con punto online), `/properties`, `/clients`, `/pipeline`, `/showings`
- [x] T015 [US2] Modificar `src/app/(dashboard)/layout.tsx`: contenedor `flex h-screen overflow-hidden bg-bg`; reemplazar el aside `w-60` por el riel de 66px (logo Inmox 38×38 arriba; `SidebarNav`; Configuración `/settings` + avatar de rol anclados abajo con `mt-auto`)
- [x] T016 [P] [US2] Añadir el logo de marca al riel: usar `design_handoff_inmox/Inmox logo.png` (copiar a `public/inmox-logo.png`) o el cuadro "I" teal como fallback, 38×38 radio 10 con sombra

**Checkpoint**: Shell navegable entre las 7 vistas (SC-003 parcial).

---

## Phase 5: User Story 3 — Bandeja WhatsApp 3 columnas + matching en vivo (Priority: P1) 🎯 núcleo

**Goal**: Bandeja rediseñada a fidelidad del handoff con el panel de matching, preservando el
wiring funcional existente (FR-030).

**Independent Test**: Abrir `/inbox`; layout 330/flex/374; filas, franja 24h, burbujas+recibos
y panel de matching (%, barra, razones, "¿Por qué?", "Enviar ficha") según handoff; enviar
texto/plantilla sigue funcionando.

- [x] T017 [US3] Ampliar `src/lib/inbox/types.ts`: añadir a `ConversationListItem` los campos de diseño (`unread?`, `assignee?`, `stage?`) y a `MessageItem` el `kind?: "text" | "property"` + payload de ficha de propiedad; definir tipos `ClientRequirements`, `Match`, `PropertyView`
- [x] T018 [US3] Crear `src/lib/design/sample-data.ts` con fixtures de muestra (conversaciones con requisitos+matches, propiedades, KPIs, actividad, visitas, clientes, leads) — datos ficticios, separados para sustitución posterior (D3)
- [x] T019 [P] [US3] Crear `src/components/properties/property-thumb.tsx`: gradiente lineal 135° estable por seed + ícono Lucide `home` al ~45% opacidad (D6), reutilizable en matching/propiedades/chat
- [x] T020 [US3] Rediseñar `src/components/inbox/inbox-client.tsx`: grid `[66?]330px_1fr_374px` (el riel vive en el layout), columna lista con header "Bandeja"+contador, estado WhatsApp, búsqueda, filtros píldora (Todas/Sin leer/Asignadas a mí/Sin asignar), filas con avatar de operación + badge no leído + seleccionada con borde izq de operación
- [x] T021 [US3] Rediseñar `src/components/inbox/chat-thread.tsx`: header (avatar, nombre, chip operación, teléfono, chip etapa, chip asesor), franja 24h abierta/cerrada con tokens, separadores de fecha, burbujas in/out (radio 14, máx 74%) con hora + recibos (✓/✓✓ gris/✓✓ teal), composer abierto (clip+input+enviar negro) / cerrado (bloque punteado bronce + enviar plantilla); **preservar** `useRealtimeMessages`, POST de texto y de plantilla, cálculo de ventana
- [x] T022 [US3] Renderizar la ficha de propiedad como burbuja (`kind: "property"`, 265px) en `chat-thread.tsx` usando `property-thumb`
- [x] T023 [US3] Crear `src/components/inbox/matching-panel.tsx`: header estrella en cuadro teal + punto pulsante + subtítulo; chips de requisitos; tarjetas rankeadas (miniatura 74px, %match color operación, barra de match, specs, chips razón cumple/no-cumple, botón "¿Por qué?" expandible, botón "Enviar ficha" que inserta ficha-burbuja en el hilo)
- [x] T024 [US3] Componer la columna de contexto en `inbox-client.tsx`: `MatchingPanel` arriba + "Datos del cliente" (teléfono, correo) + "Notas internas" (FR-018)
- [x] T025 [US3] Actualizar `src/app/(dashboard)/inbox/page.tsx` para pasar a `inbox-client` los datos de matching/requisitos (de la conversación real si existen; si no, del fixture) sin romper la carga real de conversaciones
- [x] T026 [US3] Actualizar el preview dev (`src/components/dev/inbox-preview.tsx` + `src/app/dev-preview/inbox/page.tsx`) para reflejar el nuevo layout con matching usando los fixtures
- [x] T027 [US3] Verificar no-regresión de bandeja (quickstart §3): cargar mensajes, enviar texto en ventana, enviar plantilla fuera de ventana (FR-030/SC-005)

**Checkpoint**: Bandeja con matching a fidelidad y sin regresiones.

---

## Phase 6: User Story 4 — Dashboard / Inicio con KPIs y SLA (Priority: P2)

**Goal**: Pantalla de inicio con saludo, banner SLA, KPIs y dos columnas.

**Independent Test**: Abrir `/`; ver saludo, banner SLA bronce, grilla de KPIs (sin responder
en bronce), actividad reciente y próximas visitas.

- [x] T028 [P] [US4] Crear `src/components/dashboard/kpi-card.tsx` (label, valor 30/600, delta, tono default/warn) y `src/components/dashboard/sla-banner.tsx` (bronce, conteo + "Revisar")
- [x] T029 [US4] Crear `src/app/(dashboard)/page.tsx`: contenedor centrado máx 1180px, saludo + fecha/agencia + "Ir a la bandeja", banner SLA, grilla KPIs `auto-fit minmax(190px,1fr)`, dos columnas (actividad reciente / próximas visitas) alimentadas por `sample-data.ts`

**Checkpoint**: Inicio renderizado con el sistema de diseño.

---

## Phase 7: User Story 5 — Propiedades (tarjetas / tabla) (Priority: P2)

**Goal**: Inventario con toggle tarjetas/tabla y filtros en vivo.

**Independent Test**: Abrir `/properties`; alternar Tarjetas/Tabla; filtrar por operación y
estatus en vivo.

- [x] T030 [P] [US5] Crear `src/components/properties/property-card.tsx`: foto-gradiente (property-thumb) + badge estatus (blanco) + badge operación, nombre, zona/tipo, precio 14–18/700 + "MXN", specs
- [x] T031 [P] [US5] Crear `src/components/properties/property-table.tsx`: columnas Propiedad (miniatura) · Operación · Zona · Precio · Estatus
- [x] T032 [US5] Crear `src/app/(dashboard)/properties/page.tsx` (+ client component para estado): header + contador, toggle segmentado Tarjetas/Tabla (activa negra), filtros operación (Todas/Venta/Renta) + estatus (Todos/Disponibles/Apartadas/Cerradas) filtrando en vivo, botón "Nueva propiedad", grid `auto-fill minmax(248px,1fr)`; datos de `sample-data.ts`

**Checkpoint**: Propiedades navegable con ambas vistas y filtros.

---

## Phase 8: User Story 6 — Pipeline Kanban de 7 columnas (Priority: P2)

**Goal**: Tablero Kanban con 7 etapas y tarjetas movibles.

**Independent Test**: Abrir `/pipeline`; 7 columnas con scroll horizontal; mover una tarjeta
con ‹ › y ver clamp en los extremos.

- [x] T033 [P] [US6] Crear `src/components/pipeline/pipeline-board.tsx`: tablero scroll-x, 7 columnas (248px) Nuevo→…→Ganado con cabecera (punto de etapa + label + contador), tarjeta (cliente+propiedad+asesor) con botones ‹ › (estado local, clamp en extremos)
- [x] T034 [US6] Crear `src/app/(dashboard)/pipeline/page.tsx`: header "Pipeline de ventas" + `PipelineBoard` alimentado por leads de `sample-data.ts`

**Checkpoint**: Pipeline interactivo (mover etapa) renderizado.

---

## Phase 9: User Story 7 — Visitas y Clientes (Priority: P3)

**Goal**: Lista de visitas con estado y directorio de clientes con búsqueda.

**Independent Test**: Abrir `/showings` (lista con chips de estado) y `/clients` (tabla +
búsqueda en vivo).

- [x] T035 [P] [US7] Crear `src/app/(dashboard)/showings/page.tsx`: lista máx 880px con bloque fecha (mes/día) + cliente (punto operación) + propiedad + hora/asesor + chip estado (badge de visita), nota de cabecera del recordatorio por WhatsApp; datos de `sample-data.ts`
- [x] T036 [P] [US7] Crear `src/app/(dashboard)/clients/page.tsx` (+ client component): header + búsqueda en vivo + tabla Cliente (avatar+nombre+teléfono) · Interés · Operación · Etapa · Contacto; datos de `sample-data.ts`

**Checkpoint**: Visitas y Clientes navegables.

---

## Phase 10: User Story 8 — Configuración (estado base) (Priority: P3)

**Goal**: Sección de configuración accesible con estado base.

**Independent Test**: Navegar a `/settings`; ver estado "en construcción" con el lenguaje del
sistema.

- [x] T037 [US8] Crear `src/app/(dashboard)/settings/page.tsx`: estado vacío "en construcción" consistente con tokens (icono + título + texto), accesible desde el riel

**Checkpoint**: Las 8 vistas del shell existen y son navegables (SC-003 completo).

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Cerrar fidelidad, accesibilidad, estados límite y la puerta de calidad.

- [x] T038 [P] Estados vacíos legibles en todas las vistas (sin conversaciones/propiedades/clientes/visitas/leads) con el lenguaje del sistema (FR-028)
- [x] T039 [P] Verificar truncado con elipsis y degradado elegante de conversación sin propiedad (FR-028) en bandeja/listas
- [x] T040 [P] Auditar accesibilidad: operación/estatus con texto+color (no solo color), contraste de texto legible sobre tints, `aria-label`/tooltips del riel (FR-029/SC-007)
- [x] T041 Barrido de hex sueltos: confirmar que ningún componente usa colores literales fuera de la capa de tokens salvo los gradientes placeholder (FR-006)
- [x] T042 Comparación de fidelidad lado a lado contra `design_handoff_inmox/` por vista (SC-001) y ajustar discrepancias visibles
- [x] T043 Ejecutar la puerta de calidad: `pnpm typecheck && pnpm lint && pnpm build` en verde (SC-006); corregir lo que falle
- [x] T044 Recorrer `quickstart.md` (verificación visual + no-regresión de bandeja) y dejar registro del resultado

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. **BLOQUEA todas las historias** (todo consume tokens).
- **US1 (Phase 3)**: cierra/audita la capa de tokens; depende de Foundational.
- **US2 (Phase 4)**: depende de Foundational; habilita la navegación a todas las vistas.
- **US3–US8 (Phases 5–10)**: dependen de Foundational (tokens) y de US2 (shell para ser navegables). US4–US8 dependen además de los fixtures (T018) y helpers (`property-thumb`, `badge`).
- **Polish (Phase 11)**: depende de las historias deseadas completas.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Base de todo.
- **US2 (P1)**: tras Foundational. Shell.
- **US3 (P1)**: tras Foundational + helpers; usa `property-thumb` (T019) y fixtures (T018).
- **US4–US8 (P2/P3)**: tras Foundational + US2; usan fixtures (T018), `badge` (T007), `property-thumb` (T019). Independientes entre sí.

### Within Each User Story

- Helpers/tipos antes que componentes; componentes antes que páginas que los usan.
- US3: tipos (T017) y fixtures (T018) antes que componentes de bandeja.

### Parallel Opportunities

- T005, T006, T007 (Foundational helpers) en paralelo.
- T011, T012 (US1) en paralelo.
- T028 (US4), T030+T031 (US5), T033 (US6), T035+T036 (US7) en paralelo entre historias una vez listos los fixtures y helpers.
- Polish T038–T040 en paralelo.

---

## Parallel Example: Foundational helpers

```text
Task T005: Crear src/lib/design/operation.ts
Task T006: Crear src/lib/design/status.ts
Task T007: Crear src/components/ui/badge.tsx
```

---

## Implementation Strategy

### MVP (P1: tokens + shell + bandeja)

1. Phase 1 Setup → 2 Foundational (tokens).
2. US1 (cerrar tokens) + US2 (shell) + US3 (bandeja con matching).
3. **VALIDAR**: bandeja a fidelidad y sin regresiones; las 3 vistas P1 entregan el núcleo.

### Incremental

4. US4 Dashboard → US5 Propiedades → US6 Pipeline (P2).
5. US7 Visitas+Clientes → US8 Configuración (P3).
6. Polish (Phase 11) + puerta de calidad.

---

## Notes

- [P] = archivos distintos, sin dependencias incompletas.
- Capa de presentación: no se crean entidades de BD; las vistas sin backend usan `sample-data.ts`.
- La bandeja conserva sus contratos de API y la abstracción de tiempo real (FR-030).
- "Hecho" = typecheck + lint + build en verde; fidelidad/no-regresión = verificación humana asistida.
- Fuente de verdad visual: `design_handoff_inmox/` + `contracts/ui-contract.md`.
