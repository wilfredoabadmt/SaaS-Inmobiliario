# Quickstart — Verificación de la robustez del agente (005)

Cómo verificar la feature. Cierre del sprint = **puerta de calidad automática** + **self-test de
comportamiento** de los 4 casos (metodología `feedback-self-test-after-implement`).

> Guardrail: el self-test usa `scripts/wa-tester/` con la **allowlist** de Evolution (línea personal
> 462…9768 + número de plataforma 555…8947) y **anti-ráfaga** para no bloquear la línea del dueño.

---

## 0. Puerta de calidad automática (Principio V)

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Debe quedar en verde (SC-008, parte automática).

## 1. Migración aditiva

```bash
pnpm db:generate          # revisar SQL: CREATE TYPE needs_human_reason + ADD COLUMN ×2 (sin DROP/UPDATE)
# aplicar en inmox-dev por el método del proyecto antes de activar la feature
```

---

## 2. Self-test de comportamiento (los 4 casos)

Script: `scripts/wa-tester/agent-robustness.mjs`. Activa el agente en la conversación de prueba y
ejecuta:

### Caso A — Fuera de la ventana de 24 h (US1 / SC-001)
1. Envejecer en la BD de prueba el `wa_timestamp` del último entrante de la conversación a > 24 h.
2. Disparar un mensaje entrante nuevo (vía Evolution o POST de webhook simulado).
3. **Verificar**: el agente **no** envía texto; `conversation.needs_human=true` y
   `needs_human_reason='out_of_window'`; **0** mensajes salientes nuevos registrados. La bandeja
   muestra "Fuera de ventana 24 h".

### Caso B — Mensaje no textual (US2 / SC-002)
1. Con la ventana abierta, enviar una **nota de voz** (y por separado una imagen) vía Evolution.
2. **Verificar**: llega una respuesta **determinista** pidiendo texto; `message.wa_type` quedó
   persistido (`audio`/`image`); la bandeja muestra el no-texto ("🎤 nota de voz"); la conversación
   **sigue activa** (sin handoff).
3. Enviar **otro** no-texto seguido (insiste) → `needs_human=true`,
   `needs_human_reason='uninterpretable'` y deja de auto-responder.

### Caso C — Ráfaga (US3 / SC-003, SC-005)
1. Enviar 3 mensajes de texto en rápida sucesión (< `AGENT_COALESCE_MS`), p. ej.
   "hola" / "busco depto en Polanco" / "2 recámaras, hasta 28 mil".
2. **Verificar**: el agente responde **una sola vez** con una respuesta coherente que considera los
   tres; los requisitos quedan consistentes (operación renta, zona Polanco, recámaras 2, presupuesto
   ≤28k); **0** respuestas duplicadas/contradictorias.
3. Reenviar uno de los mensajes (mismo `wa_message_id`) → **0** efectos nuevos (idempotencia).

### Caso D — Fallo del proveedor de IA (US4 / SC-004, SC-006)
1. Forzar fallo (clave de IA inválida temporal o modelo inexistente vía env de prueba).
2. Enviar un mensaje de texto.
3. **Verificar**: `conversation.needs_human=true`, `needs_human_reason='ai_error'`; **0** mensajes
   salientes; la bandeja muestra "La IA no pudo responder"; el resto de la bandeja sigue operativa; en
   logs **no** aparece la clave de IA.

### Reanudación (transversal / SC-007)
- En cualquiera de los estados anteriores, `POST /api/conversations/[id]/agent { resume:true }` debe
  poner `needs_human=false` **y** `needs_human_reason=null`, devolviendo el control al agente.

---

## 3. No-regresión (camino feliz de 004)

- Con el agente activo y dentro de ventana, un mensaje de texto normal sigue produciendo respuesta +
  calificación + (si aplica) ficha/visita, **igual que 004**.
- Con el agente **desactivado**, **0** respuestas automáticas en todos los casos (SC-007 de 004 /
  FR-016).

---

## 4. Checklist de cierre

- [ ] `pnpm typecheck && pnpm lint && pnpm build` en verde.
- [ ] Migración aditiva aplicada en inmox-dev (revisada: sin DROP/UPDATE).
- [ ] Caso A (fuera de ventana) verificado.
- [ ] Caso B (no-texto + escalada) verificado.
- [ ] Caso C (ráfaga + idempotencia) verificado.
- [ ] Caso D (fallo de IA) verificado.
- [ ] Reanudación limpia `needs_human` + motivo.
- [ ] No-regresión del camino feliz de 004.
- [ ] Evidencia (transcripción/capturas) adjunta; lo no verificable, marcado pendiente de verificación
      humana.
