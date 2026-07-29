# Contract — Comportamiento del agente endurecido (005)

Contrato **interno de comportamiento** (no es una API pública nueva). Describe cómo cambia el flujo
del agente de 004 y qué garantías expone a la bandeja. Endpoints existentes se reutilizan; solo
`POST /agent` extiende su efecto.

---

## 1. Flujo de ingest endurecido (`src/server/inbox/ingest.ts`)

Por cada mensaje entrante **nuevo** (insert con `returning`, idempotente):

```
persistir message { ..., wa_type: <tipo del webhook> }      # NUEVO: siempre guarda el tipo
actualizar conversation.lastMessageAt

si NO (aiEnabled && !needsHuman):  → fin (sin agente)         # gate opt-in + handoff (igual que 004)

si wa_type === "text" y body no vacío:
    scheduleAgentRun(orgId, convId)                          # RB-3: coalescencia (no llamada directa)
si wa_type !== "text" (no-texto):
    si ventana 24h abierta:
        enviar respuesta DETERMINISTA pidiendo texto (es-MX, sin LLM, aiGenerated=true)
    si el entrante inmediatamente anterior también fue no-texto (insiste):
        needs_human=true, needs_human_reason='uninterpretable'   # RB-2 escalada
    # si no insiste: la conversación sigue activa; el wa_type guardado es la señal en bandeja
```

**Garantías**: idempotencia preservada (el gate insert-nuevo + UNIQUE `wa_message_id` no cambia); un
no-texto nunca pasa al LLM (FR-006).

---

## 2. Coalescencia de ráfaga (`src/server/ai/coalesce.ts`)

```
scheduleAgentRun(orgId, convId):
    si hay corrida en vuelo para convId:
        marcar "pendiente de re-correr"; return
    (re)programar timer( AGENT_COALESCE_MS )    # cada llamada reinicia el timer
    al expirar:
        adquirir lock(convId)
        runAgentForInboundMessage(orgId, convId)   # relee historial acumulado de la BD
        liberar lock(convId)
        si quedó "pendiente": scheduleAgentRun(orgId, convId)   # una corrida de seguimiento
```

**Garantías**:
- Una ráfaga de N mensajes en <`AGENT_COALESCE_MS` produce **una** respuesta coherente (FR-008).
- Sin condiciones de carrera al escribir requisitos/acciones (lock por conversación, FR-009).
- Conversaciones distintas no se bloquean entre sí (lock por `convId`, FR-011).
- **Supuesto**: instancia única (estado en memoria). Escala → store compartido.

---

## 3. Verificación de ventana 24 h (`src/server/ai/agent.ts`)

```
windowOpen = (Date.now() - lastInbound.waTimestamp) < 24h
si NO windowOpen:
    NO enviar texto libre
    needs_human=true, needs_human_reason='out_of_window'
    return            # no se registra ningún mensaje saliente
```

**Garantías**: 0 envíos de texto libre fuera de ventana (FR-001/002, SC-001); 0 envíos reportados que
no salieron (FR-003).

---

## 4. Degradación ante fallo de IA (`src/server/ai/agent.ts` `catch`)

```
catch (e):
    console.error(`[agent] fallo … ${convId}: ${mensaje sin secretos}`)   # ya existe, sin secretos
    needs_human=true, needs_human_reason='ai_error'                       # NUEVO
    # no se envía ni se registra respuesta
```

**Garantías**: la conversación afectada queda señalada (FR-012); la bandeja del resto sigue operativa
(FR-013); sin fuga de secretos (FR-014/SC-006).

---

## 5. Estado a la bandeja (`src/server/inbox/queries.ts`)

`ConversationListItem` y el detalle exponen:
- `needsHuman: boolean` (existente) + **`needsHumanReason`** (nuevo): `requested | out_of_window |
  uninterpretable | ai_error | null`.
- Último mensaje: si su `wa_type` no es texto, la preview/última burbuja se renderiza como no-texto
  (p. ej. "🎤 nota de voz", "🖼️ imagen").

**UI** (`inbox-client.tsx`, `chat-thread.tsx`): badge "requiere atención humana" con **etiqueta por
motivo**:

| `needsHumanReason` | Etiqueta sugerida (es-MX) |
|--------------------|---------------------------|
| `requested` | "Pidió un asesor" |
| `out_of_window` | "Fuera de ventana 24 h" |
| `uninterpretable` | "Mensaje no interpretable" |
| `ai_error` | "La IA no pudo responder" |

---

## 6. Endpoint reutilizado: `POST /api/conversations/[id]/agent`

Sin cambio de forma; **extiende efecto**:

- `{ enabled: boolean }` — activa/desactiva el agente (igual que 004).
- `{ resume: true }` — reanuda: pone `needs_human=false` **y** `needs_human_reason=null` (NUEVO: antes
  solo limpiaba `needs_human`). Scope de tenant (`requireMember`).

**Idempotencia/seguridad**: igual que 004 (scope de tenant; no expone secretos).

---

## 7. Mensaje determinista de "pide texto" (es-MX)

Texto fijo en código (sin LLM), tono amable/profesional, p. ej.:

> "¡Gracias por tu mensaje! 🙌 Por ahora no puedo escuchar audios ni ver imágenes. ¿Me lo puedes
> escribir por texto y con gusto te ayudo?"

Se envía como `aiGenerated=true` y respeta la ventana 24 h (si está cerrada, aplica §3).
