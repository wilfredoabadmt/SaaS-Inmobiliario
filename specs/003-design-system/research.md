# Research — Sistema de diseño visual de Inmox (003)

**Feature**: `003-design-system` · **Date**: 2026-06-19 · **Fuente de verdad**:
`design_handoff_inmox/README.md` (+ `Inmox.dc.html` como referencia de comportamiento).

Resuelve las decisiones técnicas (NEEDS CLARIFICATION) previas a la Fase 1.

---

## D1 — Reconciliación de tokens: reemplazar la paleta actual por la del handoff

**Decisión**: Reemplazar los valores de la capa de tokens existente
(`src/app/globals.css` `:root` + `tailwind.config.ts`) por la **paleta papel cálida** del
handoff, conservando los **nombres de token** existentes donde el rol coincide y añadiendo
los nuevos roles (estatus de propiedad/visita, etapas de pipeline, razones de match).

**Mapeo de los tokens existentes → handoff**:

| Token actual | Valor actual | Valor handoff | Rol |
|---|---|---|---|
| `--bg` | `#ffffff` | `#f6f4ef` (page) | fondo de página |
| `--bg-panel` | `#f8f8f9` | `#ffffff` (card) | tarjetas/paneles/topbars |
| `--bg-subtle` | `#fbfbfc` | `#f6f4ef` | inputs, chips neutros |
| `--bg-hover` | `#f4f4f5` | `#f2f0ea` (thread) | hover de filas / hilo |
| `--bg-active`/sunken | `#f0fdfa` | `#efece5` (sunken) | riel, columnas Kanban, fila seleccionada |
| `--chat-bg` | `#f5f6f7` | `#f2f0ea` | fondo del hilo |
| `--border` | `#ececef` | `#e7e3da` (card) | borde de tarjeta |
| `--border-strong` | `#e2e2e6` | `#e6e1d7` (control) | inputs/controles |
| `--text` | `#1a1a1e` | `#211d16` (ink primary) | texto principal / botón primario |
| `--text-2` | `#56565e` | `#46413a` (body) | cuerpo |
| `--text-3` | `#8c8c95` | `#5c574d` (muted) | secundario |
| `--text-4` | `#aeaeb6` | `#7c776c` / `#a8a39a` (faint/faintest) | terciario / placeholder |
| venta `DEFAULT/text/tint` | teal `#0d9488…` | teal/salvia `#126b60` · pt `#1c9c8c` · bg `#eef4f1` · borde `#cfe5dd` | operación venta |
| renta `DEFAULT/text/tint` | ámbar `#d99a08…` | bronce `#9a6a1a` · pt `#c89233` · bg `#f6efdc` · borde `#e7d4a8` | operación renta |

**Tokens nuevos a añadir** (no existían):
- `--ink-strong #2a261d`, `--ink-faintest #a8a39a`, `--surface-divider #ebe8e1`,
  `--fill-avatar-sm #e2ddd2`.
- **Estatus de propiedad**: disponible (texto `#126b60` / pt `#2f9e62` / bg `#eef4f1`),
  apartada (`#9a6a1a`/`#c89233`/`#f6efdc`), cerrada (`#7c776c`/`#a8a39a`/`#ebe8e1`).
- **Estatus de visita**: agendada (`#3a5a8c`/`#5a7fb0`/`#eef1f6`), realizada (igual que
  disponible), cancelada (`#a13b32`/`#c0594e`/`#f6ecec`), no-show (= cerrada).
- **Etapas de pipeline** (7 puntos): nuevo `#9a958a` · contactado `#6b8cc4` · calificado
  `#1c9c8c` · visita agendada `#c89233` · documentación `#a394c9` · en negociación
  `#c97b86` · ganado `#2f9e62`.
- **Chat**: burbuja saliente bg `#e9f0e7`/borde `#d3e0cf`; entrante bg `#fff`/borde
  `#e7e3da`; recibo leído `#1c9c8c`; enviado/entregado `#a8a39a`; online/no leído
  `#2f9e62`; ventana 24h abierta (texto `#2f7d4f`/bg `#f1f5f2`) y cerrada
  (texto `#9a6a1a`/bg `#f7f1e3`).
- **Razones de match**: cumple (texto `#126b60`/bg `#eef4f1`/borde `#cfe5dd`), no cumple
  (texto `#a13b32`/bg `#f6ecec`/borde `#e8cfc9`).

**Rationale**: Conservar los nombres de token minimiza el blast radius — los componentes
que ya usan `bg-bg`, `text-text-3`, `bg-renta-tint`, etc. heredan la nueva paleta sin
reescribir cada clase. Solo cambian los **valores** y se **suman** roles nuevos. El handoff
es la fuente de verdad (gana sobre `001/design-tokens.md`, que queda como histórico).

**Alternativas descartadas**: (a) crear un set de tokens paralelo y migrar pantalla por
pantalla → duplica la verdad y deja la app inconsistente a mitad de camino; (b) hardcodear
los hex del handoff en cada componente → viola FR-006 y rompe la mantenibilidad.

---

## D2 — Tipografía Geist: mantener el paquete `geist`, no añadir Google Fonts

**Decisión**: Seguir usando el paquete npm `geist` (`GeistSans` ya cargado en
`src/app/layout.tsx` como `--font-geist-sans`, variable). NO añadir el `<link>` de Google
Fonts que sugiere el handoff.

**Rationale**: Es la misma familia Geist; el paquete da fuente variable self-hosted (mejor
rendimiento y soberanía, sin llamada externa en cada carga) y ya está integrado. El handoff
menciona Google Fonts solo como medio de obtener Geist en un prototipo HTML. Se añade el
suavizado y tracking del handoff (`-webkit-font-smoothing:antialiased; letter-spacing:-.006em`)
en `body`.

**Alternativas descartadas**: cargar Geist desde Google Fonts → dependencia externa
innecesaria y contraria a la preferencia self-hosted del proyecto.

---

## D3 — Datos de muestra para pantallas sin backend

**Decisión**: Las pantallas cuyo backend aún no existe (Dashboard, Propiedades, Pipeline,
Visitas, Clientes) y los datos que aún no se modelan (requisitos del cliente, ranking de
match) se construyen como **componentes de presentación que reciben datos por props**,
alimentados en esta feature por **fixtures de muestra** centralizados en
`src/lib/design/sample-data.ts`. La bandeja (US3) **sí** conserva su wiring real existente
(API de mensajes, envío de texto/plantilla); su panel de matching se alimenta de fixtures.

**Rationale**: Cumple el supuesto del spec (capa de presentación, sin entidades nuevas) y
deja cada pantalla lista para que una feature posterior reemplace el fixture por datos de la
API sin tocar el componente visual. Separar los datos de muestra en un único módulo evita
sembrar mocks por todo el árbol y facilita su borrado/sustitución.

**Alternativas descartadas**: (a) bloquear el rediseño hasta tener backend de cada sección →
contradice el objetivo de "acentuar el diseño primero"; (b) páginas dev-only como el actual
`/dev-preview` → no sirven al usuario en la app real; las secciones deben ser navegables.

---

## D4 — App shell: riel de iconos de 66px reemplaza el sidebar de 60 de ancho

**Decisión**: Reemplazar el sidebar actual (`w-60` con labels) por el **riel de iconos de
66px** del handoff: logo arriba, 6–7 botones de navegación 44×44 (radio 12) con tooltip de
texto, Configuración + avatar anclados abajo (`mt-auto`). Estado activo = superficie card
blanca + borde control + sombra sutil; inactivo = transparente + tinta atenuada. Punto verde
(online) en Bandeja cuando hay WhatsApp conectado.

**Rationale**: Es el shell que pide el handoff y maximiza el ancho útil para la bandeja de
3 columnas. `sidebar-nav.tsx` ya centraliza la navegación con `usePathname()`; se adapta a
formato de riel (icono + tooltip) en vez de icono + label.

**Responsividad** (resuelve el edge case de viewport angosto): el diseño objetivo es
**desktop-first** (herramienta de trabajo de escritorio, como en el handoff). Mínimo
soportado ~1100px de ancho útil. En anchos menores, la columna de contexto (matching) puede
colapsar/ocultarse antes que el hilo; no se diseña una vista móvil dedicada en esta feature
(fuera de alcance, se nota como pendiente).

**Alternativas descartadas**: mantener el sidebar ancho con labels → no coincide con el
handoff y roba ancho a la bandeja.

---

## D5 — Rutas nuevas y preservación del comportamiento de la bandeja

**Decisión**: Crear las rutas faltantes bajo `(dashboard)`: `/` (Inicio/dashboard),
`/properties`, `/clients`, `/pipeline`, `/showings`, y `/settings` (estado base). `/inbox`
ya existe y conserva su contrato funcional (carga de mensajes vía
`/api/conversations/:id/messages`, envío de texto y plantilla, ventana 24h). El rediseño de
la bandeja **cambia presentación, no contratos** (FR-030).

**Nota de consistencia con `sidebar-nav.tsx`**: el riel actual apunta a rutas en español
(`/properties`, `/candidacies`, `/showings`, `/team`). Se reconcilian los destinos con las
7 vistas del handoff (Inicio, Bandeja, Propiedades, Clientes, Pipeline, Visitas,
Configuración). Los nombres de ruta definitivos se fijan en el contrato de UI.

**Rationale**: El shell del handoff exige que las 7 vistas sean navegables (SC-003). Crear
las páginas con fixtures (D3) las habilita sin esperar al backend.

**Alternativas descartadas**: dejar las secciones como 404 hasta su feature funcional →
incumple SC-003 y deja el riel con enlaces muertos.

---

## D6 — Placeholders de foto de propiedad

**Decisión**: Componente reutilizable que pinta un **gradiente lineal 135°** muteado
(pizarra/salvia/arena) con un ícono Lucide `home` centrado al ~45% de opacidad en blanco,
elegido de forma estable a partir del id/título de la propiedad. Sustituible por
`<img>` real cuando exista el almacenamiento de fotos.

**Rationale**: Coincide con el handoff y evita huecos rotos sin fotos reales (edge case).
Centralizarlo permite cambiar a foto real en un solo lugar después.

---

## D7 — Accesibilidad: no depender solo del color (FR-029)

**Decisión**: Todo chip de operación y de estatus lleva **texto** (p. ej. "Venta",
"Disponible") y, donde aplica, un punto/ícono; el color es refuerzo, no único portador de la
información. Se verifica contraste de texto legible sobre los tints cálidos.

**Rationale**: FR-029/SC-007. El handoff ya acompaña color con texto en chips; se mantiene
esa regla como criterio de aceptación explícito.

---

## Resumen de decisiones

| # | Decisión | Impacto |
|---|---|---|
| D1 | Reemplazar valores de tokens por paleta papel; conservar nombres, añadir roles | `globals.css`, `tailwind.config.ts` |
| D2 | Mantener paquete `geist`; añadir suavizado/tracking | `layout.tsx`, `globals.css` |
| D3 | Fixtures de muestra centralizados; bandeja conserva wiring real | `lib/design/sample-data.ts` |
| D4 | Riel de iconos 66px, desktop-first ~1100px+ | `(dashboard)/layout.tsx`, `sidebar-nav.tsx` |
| D5 | Crear rutas de las 7 vistas; bandeja sin cambios de contrato | `app/(dashboard)/*` |
| D6 | Componente de gradiente placeholder de foto | `components/properties` |
| D7 | Operación/estatus con texto + color (no solo color) | todos los chips |
