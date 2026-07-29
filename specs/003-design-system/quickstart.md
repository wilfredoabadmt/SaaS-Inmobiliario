# Quickstart — Verificar el sistema de diseño (003)

**Feature**: `003-design-system` · **Date**: 2026-06-19

Cómo verificar la fidelidad visual contra el handoff y la ausencia de regresiones, de punta
a punta. La puerta de calidad mínima (Principio V) es **typecheck + lint + build en verde**;
la fidelidad visual y la no-regresión de la bandeja son **verificación humana asistida**.

## 0. Referencia de verdad

Abre el prototipo del handoff para comparar lado a lado:
- `design_handoff_inmox/README.md` (tokens + descripción de cada vista).
- `design_handoff_inmox/Inmox.dc.html` (aspecto/comportamiento; **no** se porta su código).

## 1. Puerta de calidad automática

```powershell
pnpm typecheck   # tsc estricto
pnpm lint        # next lint
pnpm build       # next build (compila todas las rutas nuevas)
```

Las tres en verde = "hecho" a nivel de verificación automática (SC-006). El build debe
compilar las 7 vistas sin errores de ruta.

## 2. Verificación visual (fidelidad ≥95%, SC-001/SC-002)

Levanta la app y recorre cada vista comparando contra el handoff:

```powershell
pnpm dev   # http://localhost:3000
```

Lista de control (✔ = coincide con el handoff):
- [ ] **Tokens**: fondo papel `#f6f4ef`, tarjetas blancas, tinta cálida; venta = teal/salvia
      `#126b60`, renta = bronce `#9a6a1a` (chips, puntos, barras, avatares).
- [ ] **Riel**: 66px, logo arriba, 7 botones, Configuración + avatar abajo, estado activo
      con tarjeta blanca + sombra, punto online en Bandeja.
- [ ] **Bandeja**: 3 columnas 330 / flex / 374; filas con avatar de operación + no leído;
      franja 24h abierta/cerrada; burbujas in/out + recibos; **panel de matching** con %,
      barra, chips de razón, "¿Por qué?" y "Enviar ficha".
- [ ] **Inicio**: saludo, banner SLA bronce, KPIs (sin responder en bronce), actividad y
      próximas visitas.
- [ ] **Propiedades**: toggle Tarjetas/Tabla, filtros en vivo, foto-gradiente + badges.
- [ ] **Pipeline**: 7 columnas con scroll horizontal, puntos de etapa, mover con ‹ › (clamp).
- [ ] **Visitas**: lista con chip de estado; nota de recordatorio.
- [ ] **Clientes**: búsqueda en vivo + tabla.
- [ ] **Configuración**: estado base.
- [ ] **Transversal**: operación/estatus con texto + color; estados vacíos; truncado con
      elipsis; español MX; solo modo claro.

## 3. No-regresión de la bandeja (SC-005, FR-030)

Con datos reales (o el flujo existente), confirma que el rediseño **no** rompió el
comportamiento:
- [ ] La lista de conversaciones carga y la selección abre el hilo.
- [ ] Los mensajes cargan vía la abstracción de tiempo real (polling) sin error.
- [ ] Enviar **texto** dentro de la ventana 24h funciona (POST a
      `/api/conversations/:id/messages`) y aparece la burbuja saliente.
- [ ] Fuera de la ventana, el composer ofrece **plantilla** y el envío llega a
      `…/messages/template`.
- [ ] El cálculo de ventana 24h (último entrante < 24h) sigue correcto.

> La página dev `/dev-preview/inbox` puede usarse para iterar la maqueta sin DB; las vistas
> con fixtures (`lib/design/sample-data.ts`) sirven para la verificación visual sin backend.

## 4. Comparación lado a lado (opcional, Playwright local)

Capturas de cada ruta para comparar con el handoff (sobre el navegador local, sin tocar
producción ni la BD):

```powershell
node scripts/visual/shot-preview.mjs   # ejemplo existente; extender a las rutas nuevas
```

## Criterio de aceptación

- typecheck + lint + build en verde (SC-006).
- Las 8 vistas navegables y renderizadas con el sistema de diseño (SC-003).
- Fidelidad ≥95% en la comparación lado a lado (SC-001) y 100% de tokens del handoff con
  equivalente (SC-002).
- Cero regresiones funcionales en la bandeja (SC-005).
- Operación/estatus distinguibles sin depender solo del color (SC-007).
