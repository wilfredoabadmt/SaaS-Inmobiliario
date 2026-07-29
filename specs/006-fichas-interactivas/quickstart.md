# Quickstart — Verificación de fichas interactivas (006)

Cierre del sprint = **puerta de calidad automática** + **self-test de comportamiento** (la ficha llega
como UNA tarjeta con foto + caption; un botón dispara su acción).

> Guardrail: `scripts/wa-tester/` con allowlist de Evolution (personal + plataforma) + anti-ráfaga.

---

## 0. Puerta de calidad (Principio V)

```bash
pnpm typecheck && pnpm lint && pnpm build
```

## 1. Migración aditiva

```bash
pnpm db:generate     # revisar: ALTER TABLE message ADD COLUMN property_id text (+ FK). Sin DROP/UPDATE.
# aplicar en inmox-dev antes de activar la feature
```

---

## 2. Self-test (P1 — tarjeta foto + caption)

1. Asegura que la propiedad de prueba tiene **al menos una foto** en el inventario (R2).
2. En la bandeja, abre la conversación de prueba y presiona **"Enviar ficha"** de un match con foto
   (o usa el endpoint `POST /api/conversations/[id]/ficha { propertyId }`).
3. **Verificar en el teléfono cliente**: llega **un solo** mensaje con la **foto** y, en el mismo
   mensaje, el **texto** (nombre, operación, zona, precio, specs) — no dos mensajes.
4. **Verificar en la bandeja**: la tarjeta aparece como burbuja de ficha en el hilo (el saliente quedó
   con `property_id`).
5. **Sin foto**: repetir con una propiedad **sin** foto → llega la ficha de **texto** (degradación),
   no falla.

## 3. Self-test (P2 — botones)

1. Envía una ficha con botones a la conversación de prueba.
2. **Verificar en el teléfono**: la tarjeta muestra hasta 3 botones ("Agendar visita", "Hablar con
   asesor", "Más fotos").
3. Toca cada botón y verifica:
   - **Agendar visita** → llega el prompt de fecha; al responder una fecha (con el agente activo) se
     crea una **visita** (aparece en `/showings`).
   - **Hablar con asesor** → la conversación se marca **"Pidió un asesor"** (atención humana) y el
     agente se calla.
   - **Más fotos** → llegan hasta 5 fotos adicionales; si no hay más, el aviso correspondiente.
4. **Idempotencia**: reintentar el mismo tap (mismo `wa_message_id`) → **una sola** acción.

> Nota: Evolution no siempre emite `button_reply` programáticamente; el tap puede requerir tocarlo en
> el teléfono real → marcar como **verificación humana** si no se puede automatizar.

---

## 4. No-regresión

- El agente (004/005) sigue calificando, respondiendo y haciendo handoff; ahora su "enviar ficha" sale
  como **tarjeta** (no texto) cuando hay foto.
- La ventana de 24 h (005): fuera de ventana no se envía la tarjeta libre; el botón manual avisa
  ("usa plantilla").

## 5. Checklist de cierre

- [ ] `pnpm typecheck && pnpm lint && pnpm build` en verde.
- [ ] Migración aditiva aplicada en inmox-dev (revisada: sin DROP/UPDATE).
- [ ] P1: ficha con foto llega como **una** tarjeta (foto + caption); sin foto degrada a texto.
- [ ] P1: el botón manual "Enviar ficha" **entrega** la tarjeta (ya no es cosmético).
- [ ] P2: botones visibles; cada tap dispara su acción (agendar/handoff/más fotos).
- [ ] Idempotencia del tap verificada.
- [ ] Aislamiento de tenant en tarjeta, fotos y acciones.
- [ ] Evidencia adjunta; lo no automatizable (tap de botón) marcado como verificación humana.
