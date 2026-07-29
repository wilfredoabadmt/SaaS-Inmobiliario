# Handoff: Inmox — CRM inmobiliario (WhatsApp-first)

## Overview
Inmox es un CRM inmobiliario multi-tenant (renta y venta) para inmobiliarias chicas (2–10 asesores),
con **WhatsApp como canal central**. El diferenciador estrella es el **Matching propiedad↔cliente en vivo**
dentro de la conversación. Idioma: español (México). Solo modo claro.

Este paquete documenta el prototipo de alta fidelidad para que se reconstruya en el codebase real.

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML** (un prototipo que muestra el
aspecto y el comportamiento deseados), **no código de producción para copiar tal cual**.

`Inmox.dc.html` está escrito como un "Design Component" (un formato de prototipado con un runtime propio
basado en React); **no intentes reutilizar ese runtime**. La tarea es **recrear estas pantallas en el
entorno del proyecto** (p. ej. React + Tailwind / CSS Modules, Next.js, etc.) usando sus patrones y
librerías ya establecidos. Si todavía no hay entorno, elige el stack más apropiado (sugerido: React +
TypeScript + Tailwind) e impleméntalo ahí. Toda la lógica de estado del prototipo está en una sola clase
`Component` al final del archivo — úsala como especificación de comportamiento, no como código a portar.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciados e interacciones son finales y deben replicarse
con fidelidad usando las librerías del codebase. La dirección visual es **sobria y cálida**: paleta tipo
papel, acentos de operación desaturados, tipografía Geist con pesos ligeros, bordes hairline y sombras suaves.

---

## Design Tokens

### Fuente
- **Geist** (Google Fonts), pesos 300–700. `https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700`
- Body: `-webkit-font-smoothing:antialiased; letter-spacing:-.006em`.

### Color — superficies (paleta papel cálida)
| Token | Hex | Uso |
|---|---|---|
| `surface/page` | `#f6f4ef` | Fondo de página, inputs, chips neutros |
| `surface/thread` | `#f2f0ea` | Fondo del hilo de chat, hover de filas |
| `surface/sunken` | `#efece5` | Fondo del riel de iconos, columnas Kanban |
| `surface/card` | `#ffffff` | Tarjetas, paneles, barras superiores |
| `surface/divider-fill` | `#ebe8e1` | Separadores de fecha, chips cerrada/no-show |

### Color — bordes (hairline cálido)
| Token | Hex | Uso |
|---|---|---|
| `border/card` | `#e7e3da` | Bordes de tarjetas y paneles |
| `border/control` | `#e6e1d7` | Inputs, botones secundarios, divisores de columna |
| `fill/avatar-sm` | `#e2ddd2` | Fondo de avatar pequeño de asesor |

### Color — texto / tinta (warm near-black)
| Token | Hex | Uso |
|---|---|---|
| `ink/primary` | `#211d16` | Texto principal, **botones primarios**, píldoras activas |
| `ink/strong` | `#2a261d` | Texto enfático |
| `ink/body` | `#46413a` | Texto de cuerpo |
| `ink/muted` | `#5c574d` | Secundario |
| `ink/faint` | `#7c776c` | Terciario / metadatos |
| `ink/faintest` | `#a8a39a` | Micro-labels, placeholders, timestamps |

### Color — Operación (clave del producto)
**Venta = teal/salvia sobrio · Renta = bronce.** Se usan como chip (bg + borde + punto) y como color de avatar.
| | texto | punto / barra | chip bg | chip borde | avatar bg |
|---|---|---|---|---|---|
| **Venta** | `#126b60` | `#1c9c8c` | `#eef4f1` | `#cfe5dd` | `#126b60` |
| **Renta** | `#9a6a1a` | `#c89233` | `#f6efdc` | `#e7d4a8` | `#9a6a1a` |

### Color — estatus de propiedad
| Estatus | texto | punto | bg |
|---|---|---|---|
| Disponible | `#126b60` | `#2f9e62` | `#eef4f1` |
| Apartada | `#9a6a1a` | `#c89233` | `#f6efdc` |
| Cerrada | `#7c776c` | `#a8a39a` | `#ebe8e1` |

### Color — estatus de visita
| Estatus | texto | punto | bg |
|---|---|---|---|
| Agendada | `#3a5a8c` | `#5a7fb0` | `#eef1f6` |
| Realizada | `#126b60` | `#2f9e62` | `#eef4f1` |
| Cancelada | `#a13b32` | `#c0594e` | `#f6ecec` |
| No-show | `#7c776c` | `#a8a39a` | `#ebe8e1` |

### Color — chat / varios
| Token | Hex | Uso |
|---|---|---|
| Burbuja saliente | bg `#e9f0e7` / borde `#d3e0cf` | mensajes propios |
| Burbuja entrante | bg `#ffffff` / borde `#e7e3da` | mensajes del cliente |
| Recibo leído (✓✓) | `#1c9c8c` | mensaje "leído" |
| Recibo enviado/entregado | `#a8a39a` | "enviado/entregado" |
| Online / no leído | `#2f9e62` | punto de conexión y badge de no leído |
| Ventana 24 h abierta | texto `#2f7d4f` / bg `#f1f5f2` | franja informativa |
| Ventana 24 h cerrada | texto `#9a6a1a` / bg `#f7f1e3` | franja + composer de plantilla |
| Razón "cumple" | texto `#126b60` / bg `#eef4f1` / borde `#cfe5dd` | chips de match |
| Razón "no cumple" | texto `#a13b32` / bg `#f6ecec` / borde `#e8cfc9` | chips de match |

### Color — puntos de etapa del Pipeline
nuevo `#9a958a` · contactado `#6b8cc4` · calificado `#1c9c8c` · visita agendada `#c89233` ·
documentación `#a394c9` · en negociación `#c97b86` · ganado `#2f9e62`

### Fotos de propiedad (placeholders)
No hay imágenes reales. Cada propiedad usa un **gradiente lineal 135°** muteado (pizarra/salvia/arena) con un
ícono de casa (lucide `home`) centrado al ~45% de opacidad en blanco. Ejemplos:
`linear-gradient(135deg,#39414f,#66707e)`, `linear-gradient(135deg,#3f5852,#6f928c)`,
`linear-gradient(135deg,#5f4d38,#a08a68)`, `linear-gradient(135deg,#52504a,#9a958a)`.
En producción se sustituyen por la foto real de la propiedad.

### Tipografía (escala)
| Rol | tamaño / peso / tracking |
|---|---|
| Título de pantalla (h1) | 24px / 600 / -.025em |
| Título de sección "Bandeja" | 19px / 600 / -.02em |
| Número KPI | 30px / 600 / -.03em |
| % de match | 18px / 600 / -.03em |
| Nombre del cliente (header de chat) | 15px / 600 |
| Títulos de tarjeta | 13–13.5px / 600 |
| Cuerpo | 12.5–13.5px / 400–500 |
| Precios | 14–18px / 700 |
| Micro-label (MAYÚSCULAS) | 11px / 700 / tracking .05–.06em / color `#a8a39a` |

### Radios
Tarjetas/paneles 13–14px · botones y controles 9–11px · botones del riel 12px · chips/píldoras 999px
(full) · avatares 50% · miniaturas de foto 9–10px.

### Sombras
- Tarjeta en reposo: `0 1px 3px rgba(0,0,0,.04)`
- Tarjeta en hover: `0 8px 26px rgba(0,0,0,.05)`
- Burbuja de texto: `0 1px 1px rgba(0,0,0,.03)`
- Ficha de propiedad: `0 2px 6px rgba(0,0,0,.06)`

### Espaciado
Escala observada (px): 4 · 6 · 8 · 11 · 13 · 16 · 18 · 20 · 22 · 32 · 40. Paddings de pantalla 30–40px,
gap entre tarjetas 13–16px.

### Iconografía
**Lucide** (stroke 1.8, `currentColor`, linecap/linejoin round). Iconos usados: layout-grid (Inicio),
message-circle (Bandeja), home (Propiedades), users (Clientes), columns (Pipeline), calendar (Visitas),
settings (Configuración), search, paperclip, send, check / check-check (recibos), star (matching),
chevron-left/right (mover etapa), plus, alert/clock.

---

## App shell
- Layout raíz: `display:flex; height:100vh; overflow:hidden; background:#f6f4ef`.
- **Riel de iconos** (izquierda, **66px**, fijo): logo arriba (38×38, radio 10, sombra), luego 6 botones de
  navegación (44×44, radio 12); `Configuración` y avatar "CR" anclados abajo (`margin-top:auto`).
  - Activo: `background:#ffffff; color:#211d16; border:1px solid #e6e1d7; box-shadow:0 1px 2px rgba(0,0,0,.07)`.
  - Inactivo: `background:transparent; color:#98938a`.
  - Botón Bandeja lleva un punto verde `#2f9e62` (online) en la esquina.
- Cada vista ocupa el resto del ancho. Solo una vista visible a la vez (estado `view`).

## Screens / Views

### 1. Bandeja de WhatsApp (vista central, 3 columnas)
`rail(66) + lista(330, fijo) + hilo(flex) + contexto(374, fijo)`.

**Columna izquierda — lista de conversaciones** (`background:#fff; border-right:1px solid #e7e3da`)
- Header: "Bandeja" (19/600) + contador "N chats"; fila de estado WhatsApp (punto `#2f9e62` pulsante +
  "WhatsApp conectado · +52 55 4040 1212"); input de búsqueda con ícono lupa (busca nombre/teléfono/propiedad).
- Filtros (píldoras): **Todas / Sin leer / Asignadas a mí / Sin asignar**. Activa = bg `#211d16`, texto blanco.
- Fila de conversación: avatar 42px (bg color de operación, iniciales blancas) con badge de no leído `#2f9e62`;
  nombre (peso 700 si no leído, 600 si leído) + hora (verde si no leído); último mensaje (1 línea, elipsis);
  chip de operación + nombre de propiedad. Seleccionada: `background:#efece5` + borde izquierdo 3px del color de
  operación. Hover: `#f2f0ea`.

**Columna central — hilo de chat** (`background:#f2f0ea`)
- Header: avatar + nombre (15/600) + chip de operación + teléfono; a la derecha chip de etapa (con ✓) y chip de
  asesor asignado (avatar pequeño + nombre).
- **Franja de ventana de 24 h** bajo el header: abierta (verde `#2f7d4f`, "Ventana de 24 h abierta · cierra en
  4 h 12 min") o cerrada (bronce, "requiere plantilla").
- Mensajes (scroll, se ancla abajo): separadores de fecha (píldora gris centrada); burbujas entrante/saliente
  (máx 74% ancho, radio 14) con hora + recibo (✓ enviado, ✓✓ gris entregado, ✓✓ teal leído);
  **ficha de propiedad** como burbuja (265px: foto-gradiente con badge de operación + nombre + colonia/ciudad +
  precio + specs).
- **Composer**: si la ventana está abierta → botón adjuntar (clip) + input "Escribe un mensaje…" + botón enviar
  (negro). Si está cerrada → bloque con borde punteado bronce explicando la ventana cerrada + botón
  "Enviar plantilla «recordatorio_visita»" (al enviarla, la ventana se reabre).

**Columna derecha — Matching en vivo + contexto** (`background:#fff; border-left:1px solid #e7e3da`, scroll)
- Ver §Matching abajo, luego "Datos del cliente" (teléfono, correo) y "Notas internas".

### 2. ⭐ Matching propiedad↔cliente en vivo (diferenciador)
Panel superior de la columna derecha de la Bandeja.
- Header: ícono estrella en cuadro teal `#126b60`, título "Matching en vivo" + punto verde pulsante, subtítulo
  "N propiedades para {nombre}". Debajo, chips de **requisitos del cliente** (operación, presupuesto, zona, tipo,
  recámaras, baños) en gris neutro.
- Lista de **propiedades rankeadas por afinidad**, cada tarjeta:
  - Miniatura 74px (gradiente), nombre, **% de match** (18/600, color de operación), colonia/ciudad, precio.
  - **Barra de match** (alto 5px, ancho = %, color de operación sobre pista `#ebe8e1`).
  - Specs + **chips de razones** "¿por qué encaja?" (verde ✓ cumple, terracota ✗ no cumple).
  - Botón **"¿Por qué?"** que expande un párrafo de explicación.
  - Botón **"Enviar ficha"** (negro) → **inserta la ficha de la propiedad como mensaje en el hilo** y la marca como
    último mensaje de la conversación.

### 3. Tablero / Inicio (Dashboard)
Contenedor centrado, `max-width:1180px`, padding 30–40px, fondo `#f6f4ef`.
- Saludo "Buenos días, Carlos" + fecha/agencia; botón "Ir a la bandeja".
- **Banner de SLA** (cálido bronce): "4 leads sin responder hace más de 30 min" + botón "Revisar".
- **KPIs** (grid `auto-fit minmax(190px,1fr)`): Leads nuevos (12, ▲3 hoy), Conversaciones activas (28),
  Visitas esta semana (7), Cierres del mes (3 · $14.2M), Sin responder (4, tarjeta en bronce).
- Dos columnas: **Actividad reciente del equipo** (lista con avatar + texto + tiempo) y **Próximas visitas**
  (bloque de fecha + cliente + propiedad + hora/asesor).

### 4. Propiedades (inventario)
- Header: "Propiedades" + contador; **toggle Tarjetas / Tabla** (segmented, activa = negra); botón "Nueva propiedad".
- Filtros: operación (Todas/Venta/Renta) + separador + estatus (Todos/Disponibles/Apartadas/Cerradas). Activos
  filtran la lista en vivo.
- **Tarjetas**: grid `auto-fill minmax(248px,1fr)`. Foto-gradiente con badge de estatus (blanco) y de operación;
  nombre, colonia/ciudad/tipo, precio grande + "MXN", specs.
- **Tabla**: columnas Propiedad · Operación · Zona · Precio · Estatus (con miniatura por fila).

### 5. Pipeline (Kanban)
- Header "Pipeline de ventas". Tablero con **scroll horizontal**, 7 columnas (248px c/u):
  Nuevo → Contactado → Calificado → Visita agendada → Documentación → En negociación → Ganado.
- Header de columna: punto de color de etapa + label + contador.
- Tarjeta = **cliente + propiedad + asesor**, con botones **‹ ›** para mover entre etapas (clamp en los extremos).

### 6. Visitas
- Lista (`max-width:880px`) de visitas próximas y recientes: bloque de fecha (mes/día) + cliente (con punto de
  operación) + propiedad + hora/asesor + **chip de estado** (agendada/realizada/cancelada/no-show).
- Nota de cabecera: recordatorio automático por WhatsApp (plantilla aprobada) al cliente.

### 7. Clientes
- Header + búsqueda (filtra en vivo). Tabla: Cliente (avatar+nombre+teléfono) · Interés · Operación · Etapa · Contacto.

### Configuración
- Estado vacío "en construcción" (fuera del alcance de esta entrega).

---

## Interactions & Behavior
- **Navegación**: el riel cambia `view`; solo una vista visible.
- **Seleccionar conversación**: actualiza hilo + contexto + matching; resetea `draft` y razones expandidas.
- **Filtrar/buscar** (bandeja, propiedades, clientes): filtra en vivo por estado/operación/estatus/texto.
- **Enviar mensaje**: botón o Enter (sin Shift) → agrega burbuja saliente (estado "enviado"); limpia el input;
  el hilo hace auto-scroll al fondo.
- **Enviar ficha** (matching): agrega una burbuja tipo "property" con la propiedad; actualiza el último mensaje.
- **Plantilla** (ventana cerrada): agrega burbuja y marca la ventana como abierta.
- **Mover etapa** (Kanban): ‹/› desplazan la tarjeta una etapa; deshabilitado en los extremos.
- **Toggle vista** (propiedades): alterna Tarjetas/Tabla.
- **Hover**: tarjetas elevan sombra; filas tiñen el fondo; botones aclaran/oscurecen.
- **Animaciones**: punto online y de matching con `pulse` (opacidad 1→.3→1, ~1.8–2.2s).

## State Management
Estado del prototipo (todo en memoria, sin backend):
- `view` — pantalla activa.
- `selectedId` — conversación abierta.
- `filter` (bandeja), `propOp`, `propStatus`, `propView`, `clientSearch`, `search` — filtros/búsquedas.
- `draft` — texto del composer.
- `expanded{ }` — qué razones de match están expandidas.
- `convs[ ]` — conversaciones; cada una: datos del cliente, requisitos, notas, `messages[ ]` (date/text/property,
  con `dir` y `status`), `matches[ ]` (propiedad + `pct` + `reasons[ ]` + `why`), `windowOpen`.
- `leads[ ]` — tarjetas del pipeline (cliente, propiedad, operación, asesor, `stage`).
- Datos de inventario, visitas y clientes son arreglos estáticos.

En producción esto se reemplaza por datos de la API (WhatsApp Cloud API para mensajes/plantillas/ventana 24 h;
el ranking de matching se calcula en el backend a partir de requisitos del cliente vs. inventario).

## Assets
- `Inmox logo.png` — logo (casa + "X" dorada sobre negro). Se usa 38×38 con radio 10 en el riel.
- Sin otras imágenes: las fotos de propiedad son gradientes placeholder → sustituir por fotos reales.
- Iconos: Lucide (recrear con la librería de íconos del codebase).

## Files
- `Inmox.dc.html` — prototipo hi-fi completo (las 7 vistas + lógica de estado en la clase `Component` al final).
- `Inmox logo.png` — logo.
