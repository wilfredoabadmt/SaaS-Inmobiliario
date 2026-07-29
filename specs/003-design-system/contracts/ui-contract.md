# UI Contract — Sistema de diseño visual de Inmox (003)

**Feature**: `003-design-system` · **Date**: 2026-06-19 · **Fuente**:
`design_handoff_inmox/README.md`. Este contrato fija los tokens, el shell y el contrato
visual de cada vista. Es el criterio verificable de fidelidad (SC-001, SC-002).

---

## 1. Capa de tokens

### CSS variables (`src/app/globals.css` `:root`) — valores finales

```
/* superficies (paleta papel cálida) */
--bg: #f6f4ef;            /* page */
--bg-panel: #ffffff;      /* card: tarjetas, paneles, topbars */
--bg-subtle: #f6f4ef;     /* inputs, chips neutros */
--bg-hover: #f2f0ea;      /* thread / hover de filas */
--bg-sunken: #efece5;     /* riel, columnas Kanban, fila seleccionada */
--surface-divider: #ebe8e1;
--chat-bg: #f2f0ea;

/* bordes (hairline cálido) */
--border: #e7e3da;        /* card */
--border-strong: #e6e1d7; /* control */
--fill-avatar-sm: #e2ddd2;

/* tinta (warm near-black) */
--text: #211d16;          /* ink/primary + botón primario */
--ink-strong: #2a261d;
--text-2: #46413a;        /* body */
--text-3: #5c574d;        /* muted */
--text-4: #7c776c;        /* faint */
--ink-faintest: #a8a39a;  /* micro-label, placeholder, timestamp */

/* operación */
--venta: #126b60; --venta-dot: #1c9c8c; --venta-tint: #eef4f1; --venta-border: #cfe5dd;
--renta: #9a6a1a; --renta-dot: #c89233; --renta-tint: #f6efdc; --renta-border: #e7d4a8;

/* chat */
--bubble-out-bg: #e9f0e7; --bubble-out-border: #d3e0cf; --bubble-out-text: #211d16;
--bubble-in-bg: #ffffff;  --bubble-in-border: #e7e3da;
--receipt-read: #1c9c8c;  --receipt-sent: #a8a39a;  --online: #2f9e62;
--win-open-text: #2f7d4f; --win-open-bg: #f1f5f2;
--win-closed-text: #9a6a1a; --win-closed-bg: #f7f1e3;

/* razones de match */
--match-ok-text: #126b60; --match-ok-bg: #eef4f1; --match-ok-border: #cfe5dd;
--match-no-text: #a13b32; --match-no-bg: #f6ecec; --match-no-border: #e8cfc9;

/* radios */
--radius-sm: 9px; --radius: 11px; --radius-lg: 14px; --radius-rail: 12px;
```

### Tailwind theme (`tailwind.config.ts`) — claves nuevas/ajustadas

- `colors.bg.{DEFAULT,panel,subtle,hover,sunken}`, `colors.border.{DEFAULT,strong}`,
  `colors.text.{DEFAULT,2,3,4}`, `colors.ink.{strong,faintest}`.
- `colors.venta.{DEFAULT,dot,tint,border}`, `colors.renta.{DEFAULT,dot,tint,border}`.
- `colors.status.{online,ok}` y mapas para estatus de propiedad/visita y etapa (ver abajo)
  expuestos como utilidades o data-attributes; alternativamente clases `cva` en `badge.tsx`.

### Estatus de propiedad (texto / punto / bg)

| Estatus | texto | punto | bg |
|---|---|---|---|
| disponible | `#126b60` | `#2f9e62` | `#eef4f1` |
| apartada | `#9a6a1a` | `#c89233` | `#f6efdc` |
| cerrada | `#7c776c` | `#a8a39a` | `#ebe8e1` |

### Estatus de visita

| Estatus | texto | punto | bg |
|---|---|---|---|
| agendada | `#3a5a8c` | `#5a7fb0` | `#eef1f6` |
| realizada | `#126b60` | `#2f9e62` | `#eef4f1` |
| cancelada | `#a13b32` | `#c0594e` | `#f6ecec` |
| no_show | `#7c776c` | `#a8a39a` | `#ebe8e1` |

### Puntos de etapa de pipeline

nuevo `#9a958a` · contactado `#6b8cc4` · calificado `#1c9c8c` · visita_agendada `#c89233` ·
documentacion `#a394c9` · en_negociacion `#c97b86` · ganado `#2f9e62`.

### Tipografía (Geist variable, ya cargada)

`body { -webkit-font-smoothing: antialiased; letter-spacing: -.006em; }`. Escala:
h1 24/600/-.025em · sección 19/600/-.02em · KPI 30/600/-.03em · %match 18/600/-.03em ·
nombre 15/600 · título tarjeta 13–13.5/600 · cuerpo 12.5–13.5/400–500 · precio 14–18/700 ·
micro-label 11/700/tracking .05–.06em color `#a8a39a`.

### Sombras

reposo `0 1px 3px rgba(0,0,0,.04)` · hover `0 8px 26px rgba(0,0,0,.05)` · burbuja
`0 1px 1px rgba(0,0,0,.03)` · ficha de propiedad `0 2px 6px rgba(0,0,0,.06)`.

### Iconografía

Lucide (`lucide-react`), stroke 1.8, `currentColor`, linecap/linejoin round. Íconos:
layout-grid (Inicio), message-circle (Bandeja), home (Propiedades), users (Clientes),
columns (Pipeline), calendar (Visitas), settings (Configuración), search, paperclip, send,
check / check-check, star (matching), chevron-left/right, plus, alert/clock.

---

## 2. App shell (riel de iconos)

- Layout raíz del dashboard: `flex; height:100vh; overflow:hidden; background:#f6f4ef`.
- **Riel** izquierdo fijo **66px**: logo arriba (38×38, radio 10, sombra); 6 botones de
  navegación 44×44 (radio 12); Configuración + avatar anclados abajo (`mt-auto`).
  - Activo: `bg #ffffff; color #211d16; border 1px #e6e1d7; shadow 0 1px 2px rgba(0,0,0,.07)`.
  - Inactivo: `bg transparent; color #98938a`.
  - Bandeja: punto verde `#2f9e62` (online) en esquina cuando hay WhatsApp conectado.
- Cada botón muestra **tooltip** con el nombre de la vista (accesibilidad + claridad).
- Rutas (reconciliadas con las 7 vistas): `/` Inicio · `/inbox` Bandeja · `/properties`
  Propiedades · `/clients` Clientes · `/pipeline` Pipeline · `/showings` Visitas ·
  `/settings` Configuración.

---

## 3. Contrato por vista

### Bandeja `/inbox` (3 columnas: lista 330 fija · hilo flex · contexto 374 fija)

- **Lista**: header "Bandeja" 19/600 + contador "N chats"; fila de estado WhatsApp (punto
  pulsante + número); búsqueda (nombre/teléfono/propiedad); filtros píldora
  Todas/Sin leer/Asignadas a mí/Sin asignar (activa `bg #211d16`, texto blanco). Fila:
  avatar 42px color de operación + badge no leído; nombre (700 si no leído) + hora; último
  mensaje 1 línea elipsis; chip operación + propiedad. Seleccionada: `bg #efece5` + borde
  izq 3px color de operación. Hover `#f2f0ea`.
- **Hilo** (`bg #f2f0ea`): header (avatar, nombre 15/600, chip operación, teléfono, chip de
  etapa con ✓, chip de asesor); **franja 24h** (abierta verde "cierra en …" / cerrada
  bronce "requiere plantilla"); separadores de fecha (píldora gris); burbujas in
  (blanca)/out (verde claro) máx 74% radio 14, hora + recibo (✓ enviado, ✓✓ gris entregado,
  ✓✓ teal leído); **ficha de propiedad** como burbuja (265px). Composer: abierta → clip +
  input + enviar (negro); cerrada → bloque punteado bronce + "Enviar plantilla «…»" (al
  enviar reabre ventana).
- **Contexto** (`bg #fff`): §Matching (ver abajo) → "Datos del cliente" (teléfono, correo) →
  "Notas internas".
- **Comportamiento preservado (FR-030)**: carga de mensajes vía la abstracción de tiempo
  real (`lib/realtime`), envío de texto a `/api/conversations/:id/messages`, envío de
  plantilla a `…/messages/template`, cálculo de ventana 24h. **Sin cambios de contrato.**

### Matching en vivo (panel superior de la columna de contexto) ⭐

- Header: ícono estrella en cuadro teal `#126b60`; "Matching en vivo" + punto verde
  pulsante; subtítulo "N propiedades para {nombre}". Chips de **requisitos** (operación,
  presupuesto, zona, tipo, recámaras, baños) en gris neutro.
- Tarjetas rankeadas: miniatura 74px (gradiente), nombre, **% match** 18/600 color de
  operación, zona, precio; **barra de match** alto 5px ancho = % color de operación sobre
  pista `#ebe8e1`; specs + chips de razón (✓ cumple verde / ✗ no cumple terracota); botón
  **"¿Por qué?"** expande párrafo; botón **"Enviar ficha"** (negro) → inserta ficha-burbuja
  en el hilo y la marca como último mensaje.

### Inicio `/` (Dashboard, contenedor centrado máx 1180px, padding 30–40)

Saludo "Buenos días, {nombre}" + fecha/agencia + botón "Ir a la bandeja"; **banner SLA**
bronce ("N leads sin responder hace > 30 min" + "Revisar"); **KPIs** grid
`auto-fit minmax(190px,1fr)` (leads nuevos, conversaciones activas, visitas semana, cierres
del mes, sin responder en bronce); dos columnas: actividad reciente (avatar+texto+tiempo) y
próximas visitas (bloque fecha + cliente + propiedad + hora/asesor).

### Propiedades `/properties`

Header "Propiedades" + contador; **toggle Tarjetas/Tabla** (segmented, activa negra); botón
"Nueva propiedad". Filtros operación (Todas/Venta/Renta) + estatus
(Todos/Disponibles/Apartadas/Cerradas), filtran en vivo. Tarjetas: grid
`auto-fill minmax(248px,1fr)`, foto-gradiente con badge estatus (blanco) + operación,
nombre, zona/tipo, precio grande + "MXN", specs. Tabla: Propiedad · Operación · Zona ·
Precio · Estatus (miniatura por fila).

### Pipeline `/pipeline`

Header "Pipeline de ventas"; tablero **scroll horizontal**, 7 columnas (248px): Nuevo →
Contactado → Calificado → Visita agendada → Documentación → En negociación → Ganado.
Cabecera: punto color de etapa + label + contador. Tarjeta: cliente + propiedad + asesor +
botones ‹ › (clamp en extremos).

### Visitas `/showings`

Lista (máx 880px): bloque fecha (mes/día) + cliente (punto de operación) + propiedad +
hora/asesor + chip de estado (agendada/realizada/cancelada/no-show). Nota de cabecera:
recordatorio automático por WhatsApp (plantilla aprobada).

### Clientes `/clients`

Header + búsqueda (filtra en vivo). Tabla: Cliente (avatar+nombre+teléfono) · Interés ·
Operación · Etapa · Contacto.

### Configuración `/settings`

Estado base "en construcción" con el lenguaje del sistema (contenido funcional fuera de
alcance).

---

## 4. Reglas transversales (verificables)

- Español (México); **solo modo claro**.
- Operación y estatus distinguibles por **texto + color** (no solo color) — FR-029/SC-007.
- Estados vacíos legibles; texto largo trunca con elipsis sin romper columnas fijas.
- Conversación sin propiedad degrada sin chip de operación ni matching.
- Sin foto real → gradiente placeholder con ícono `home`.
- Ningún hex suelto fuera de la capa de tokens (salvo gradientes placeholder) — FR-006.
- Animaciones `pulse` (opacidad 1→.3→1, ~1.8–2.2s) en puntos online y de matching.
