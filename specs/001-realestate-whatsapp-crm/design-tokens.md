# Design Tokens (extraídos de `docs/design/`)

> ⚠️ **DEPRECADO (2026-06-19).** Estos tokens (producto "Hábitat", teal `#0d9488`,
> ámbar `#d99a08`) quedaron sustituidos por el sistema de diseño de la feature
> **003-design-system**, cuya **fuente de verdad** es `design_handoff_inmox/`
> (paleta papel cálida, venta = teal/salvia `#126b60`, renta = bronce `#9a6a1a`).
> Ver `specs/003-design-system/contracts/ui-contract.md`. Se conserva este archivo
> solo como histórico.

**Feature**: `001-realestate-whatsapp-crm` · **Date**: 2026-06-07 · **Fuente**:
`docs/design/Bandeja WhatsApp (offline).html` y `docs/design/Propiedades (offline).html`

> Valores **leídos** del `:root` y de los estilos embebidos en los HTML de
> referencia (resolución de **DV-3**). No son inventados. Se replican en
> Tailwind/shadcn (modo claro). Producto: **"Hábitat"** (título de los mockups).

## Tipografía

- **Familia**: **Geist** (variable). Stack: `"Geist", -apple-system, BlinkMacSystemFont, sans-serif`.
- **Pesos en uso**: 400, 500, **550**, 600, **650**, **680**, 700 (variable font;
  respetar los pesos intermedios 550/650/680 — son intencionales).
- **Tamaños observados**: 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 17, 20 px.

## Variables de color (`:root`) — sistema base

| Token | Valor | Uso |
|-------|-------|-----|
| `--accent` | `#0d9488` | acento de marca (teal-600) |
| `--accent-hover` | `#0f766e` | hover del acento |
| `--accent-soft` | `#ccfbf1` | relleno suave del acento |
| `--accent-tint` | `#f0fdfa` | tinte muy claro del acento |
| `--accent-text` | `#115e59` | texto sobre tinte / texto de acento |
| `--bg` | `#ffffff` | fondo base |
| `--bg-subtle` | `#fbfbfc` | fondo sutil |
| `--bg-panel` | `#f8f8f9` | fondo de paneles |
| `--bg-hover` | `#f4f4f5` | hover de filas |
| `--bg-active` | `#f0fdfa` | fila activa (= accent-tint) |
| `--border` | `#ececef` | borde estándar |
| `--border-strong` | `#e2e2e6` | borde marcado |
| `--text` | `#1a1a1e` | texto principal |
| `--text-2` | `#56565e` | texto secundario |
| `--text-3` | `#8c8c95` | texto terciario |
| `--text-4` | `#aeaeb6` | texto deshabilitado/placeholder |
| `--chat-bg` | `#f5f6f7` | fondo del hilo de chat |
| `--bubble-out-text` | `#134e4a` | texto de burbuja saliente |

## Acento por tipo de operación (regla del producto)

- **VENTA → teal** (usa el sistema `--accent`): texto `#115e59`/`#134e4a`,
  relleno `#f0fdfa`/`#ccfbf1`, acento `#0d9488`.
- **RENTA → ámbar** (paleta dedicada extraída de los badges de operación):

| Rol | Valor |
|-----|-------|
| acento ámbar | `#d99a08` (alt. `#c2790a`) |
| texto ámbar (oscuro) | `#9a5b00` |
| relleno/tint | `#fff8ed`, `#fffbeb` |
| borde suave | `#fce8c8`, `#fde6c4` |

## Estado / presencia

- Verde "en línea" / enviado: `#22c55e`, `#16a34a`.

## Radios (`:root`)

| Token | Valor |
|-------|-------|
| `--radius-sm` | `7px` |
| `--radius` | `10px` |
| `--radius-lg` | `14px` |
| pastillas (pills) | `999px` |
| avatares | `50%` |

(Adicionales literales vistos: 5px, 6px, 8px, 9px en chips/badges puntuales.)

## Spacing / densidad

- Variable de fila: `--row-py: 11px` (densidad de filas de la bandeja).
- Paddings representativos: `16px 12px 14px` (header de columna), `8px 10px`,
  `12px 16px`, `5px 12px` (chips), `2px 7px` (badges), `48px 24px` (estado vacío).
- Gaps: 2–12px (mayoría 6–10px). Layout denso, de herramienta de trabajo.

## Layout (estructura observada)

- **Bandeja**: **3 columnas** — lista de conversaciones · hilo de chat
  (`--chat-bg`) · panel lateral (propiedad + candidato).
- **Catálogo**: grid de tarjetas de propiedad; ícono de "casa" como marca; thumbnail
  teal.

## Notas de fidelidad

- Mapear las variables `:root` a tokens de Tailwind (extender el theme) en lugar de
  hardcodear hex en componentes, para conservar el sistema.
- Los pesos 550/650/680 requieren la fuente **Geist variable**; no redondear a
  500/700.
- Pendiente menor: si aparecen tokens adicionales al renderizar los mockups,
  reconciliar contra este archivo (es el extracto estático del bundle).
