# Data Model — Robustez del agente (005)

Cambios **aditivos** al esquema de dominio (`src/lib/db/schema/domain.ts`). **Sin tablas nuevas, sin
alterar datos existentes.** Migración Drizzle aditiva en `drizzle/`.

---

## Enum nuevo: `needs_human_reason`

`pgEnum("needs_human_reason", [...])` con los valores:

| Valor | Significado | Quién lo setea |
|-------|-------------|----------------|
| `requested` | El cliente pidió un humano, o el modelo decidió handoff (cierre/sensible) | Agente 004 (heurística `asksForHuman` o `action.handoff`) |
| `out_of_window` | Llegó un mensaje fuera de la ventana de 24 h; el agente no puede responder con texto libre | `agent.ts` (RB-1) |
| `uninterpretable` | El cliente insiste con mensajes no textuales que la IA no interpreta | `ingest.ts` (RB-2) |
| `ai_error` | El proveedor de IA falló o agotó timeout al procesar | `agent.ts` `catch` (RB-4) |

> El valor es **el último motivo** por el que la conversación pasó a requerir atención humana. Es
> informativo para la bandeja; no es un historial.

---

## Tabla `conversation` (extendida)

| Columna | Tipo | Notas |
|---------|------|-------|
| … (existentes) | | `aiEnabled`, `needsHuman` ya existen (004) |
| **`needs_human_reason`** | `needs_human_reason` (enum), **nullable** | NUEVO. `null` cuando `needs_human=false`. Se fija junto con `needs_human=true`. |

**Reglas**:
- Invariante: si `needs_human = false` ⇒ `needs_human_reason IS NULL`.
- Al hacer handoff/ceder, se setean **ambos** (`needs_human=true` + reason correspondiente).
- Reanudar el agente (`POST /agent { resume:true }`) pone `needs_human=false` **y**
  `needs_human_reason=null`.
- Scope de tenant: toda lectura/escritura filtra por `organization_id` (Principio III).

**Sin índice nuevo**: la columna se lee junto a la conversación ya cargada; no se filtra por motivo en
queries de lista (volumen pequeño).

---

## Tabla `message` (extendida)

| Columna | Tipo | Notas |
|---------|------|-------|
| … (existentes) | | `body`, `direction`, `aiGenerated`, `waMessageId` (UNIQUE), `waTimestamp`… |
| **`wa_type`** | `text`, **nullable** | NUEVO. Tipo del mensaje entrante reportado por WhatsApp: `text`, `audio`, `image`, `video`, `document`, `location`, `sticker`, `contacts`. `null` para salientes/históricos. |

**Reglas**:
- Para entrantes: se llena desde `msg.type` del webhook. Para `text`, `body` lleva el contenido (como
  hoy); para no-texto, `body` puede ser `null` y `wa_type` indica el tipo (la bandeja lo renderiza,
  p. ej. "🎤 nota de voz").
- No cambia el UNIQUE de idempotencia (`wa_message_id`) ni el render de texto existente.
- Histórico: filas previas quedan con `wa_type = null` (compatibles; se asume texto en lectura).

---

## Transiciones de estado del agente por conversación

```
                 cliente pide humano / cierre (004)
   [activo] ───────────────────────────────────────────▶ [needs_human: requested]
      │
      │ mensaje fuera de ventana 24h (RB-1)
      ├───────────────────────────────────────────────▶ [needs_human: out_of_window]
      │
      │ no-texto repetido / insiste (RB-2)
      ├───────────────────────────────────────────────▶ [needs_human: uninterpretable]
      │
      │ fallo del proveedor de IA (RB-4)
      └───────────────────────────────────────────────▶ [needs_human: ai_error]

   [needs_human: *] ──(asesor: POST /agent { resume:true })──▶ [activo]
                       (needs_human=false, reason=null)
```

- En cualquier estado `needs_human`, el agente **no** auto-responde (gate ya existente en `agent.ts`
  y en el disparo de `ingest.ts`).
- El no-texto **no escalado** (primer no-texto, sin insistir) **no** cambia el estado: la conversación
  sigue `activo`; solo se responde pidiendo texto y se persiste `wa_type` (señal informativa en
  bandeja).

---

## DTOs de la bandeja (`src/lib/inbox/types.ts`)

| Tipo | Cambio |
|------|--------|
| `ConversationListItem` | + `needsHumanReason?: 'requested' \| 'out_of_window' \| 'uninterpretable' \| 'ai_error' \| null` |
| `MessageItem` | + `waType?: string \| null` (para renderizar el último entrante no-texto) |

Estos campos son **opcionales** (no rompen consumidores existentes ni el preview con fixtures de 003).

---

## Migración

- Generar con `pnpm db:generate`; revisar el SQL en `drizzle/` (debe ser solo `CREATE TYPE` del enum +
  `ALTER TABLE ... ADD COLUMN` ×2; **sin** `DROP`/`UPDATE` de datos).
- Aplicar en inmox-dev por el método del proyecto (Pre-Deployment / migración manual) antes de activar
  la feature.
