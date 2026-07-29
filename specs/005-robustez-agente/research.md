# Research — Robustez del agente de IA (005)

Decisiones técnicas (Principio VII). Cada una resuelve un NEEDS CLARIFICATION del Technical Context o
fija un patrón. Formato: **Decisión · Razón · Alternativas descartadas**.

---

## RB-1 — Verificación de la ventana de 24 h **server-side** antes de enviar

- **Decisión**: En `src/server/ai/agent.ts`, antes de cualquier envío de texto libre, calcular si la
  ventana de 24 h está abierta a partir del **último mensaje entrante** de la conversación
  (`Date.now() - lastInbound.waTimestamp < 24h`). Si está **cerrada**: no enviar nada, marcar
  `needs_human = true` con `needs_human_reason = 'out_of_window'` y terminar (sin registrar envío).
- **Razón**: Hoy el agente envía sin chequear; Meta rechaza el texto libre fuera de ventana y el
  `catch` se traga el error → fallo silencioso (US1). La lógica ya existe en cliente
  (`chat-thread.tsx` `windowOpen`); se replica en servidor como única fuente de verdad para el agente.
- **Alternativas descartadas**:
  - *Intentar enviar y reaccionar al error de Meta (131047/131026…)*: más frágil (depende de mapear
    códigos), gasta una llamada y aún así hay que decidir; mejor prevenir con el timestamp.
  - *Auto-enviar una plantilla aprobada de reenganche*: descartado en el clarify (requiere plantilla
    aprobada + selección; fuera de v1). El asesor manda plantilla a mano (capacidad de 001).

## RB-2 — Detección y manejo de mensajes **no textuales**

- **Decisión**: En `src/server/inbox/ingest.ts`, quitar la condición que exige `msg.text?.body` para
  procesar. Determinar el **tipo** del mensaje entrante desde el webhook (`msg.type`: `text`, `audio`,
  `image`, `video`, `document`, `location`, `sticker`, `contacts`) y **persistirlo** en
  `message.wa_type`. Si el tipo **no es texto** y el agente está activo:
  1. Responder con un mensaje **determinista** (plantilla de texto fija en código, es-MX, sin LLM)
     pidiendo amablemente que lo escriban por texto — **solo si la ventana está abierta** (si no,
     aplica RB-1).
  2. Mantener el agente **activo** (no handoff inmediato).
  3. **Escalar a handoff** (`needs_human=true`, `needs_human_reason='uninterpretable'`) si el cliente
     **insiste** (el mensaje entrante **inmediatamente anterior** también fue no-texto) o si pide
     humano (heurística `asksForHuman` ya existente — aunque en no-texto no hay texto que analizar, el
     caso "insiste" cubre la repetición).
- **Razón**: Cumple el clarify (pedir texto + señal, seguir activo, handoff si insiste) sin gastar
  LLM en algo que no puede interpretar (FR-006: no inventar el contenido). Persistir `wa_type` hace
  que la bandeja **muestre** el no-texto ("🎤 nota de voz", "🖼️ imagen") → satisface FR-005 (no queda
  invisible) aun sin handoff.
- **Alternativas descartadas**:
  - *Pasar el no-texto al LLM*: el modelo del agente no es multimodal; alucinaría el contenido
    (viola FR-006). El soporte real es la feature de **agente multimodal** (separada).
  - *Handoff inmediato en todo no-texto*: descartado en el clarify (satura al asesor; mata la
    autonomía del agente). Se prefiere pedir texto y escalar solo si insiste.
  - *No persistir el tipo y solo responder*: dejaría la bandeja sin señal del no-texto (incumple
    FR-005).

## RB-3 — Coalescencia de **ráfaga** por conversación (debounce + lock en memoria)

- **Decisión**: Introducir `src/server/ai/coalesce.ts` con estado **en memoria** por
  `conversationId`:
  - **Debounce**: cada entrante (con agente activo) (re)programa un temporizador de `AGENT_COALESCE_MS`
    (env, default ~6 s). Mensajes que llegan dentro de la ventana **reinician** el temporizador. Al
    expirar, se invoca el agente **una vez**.
  - **Lock**: mientras una corrida del agente está en vuelo para esa conversación, los nuevos
    entrantes no lanzan otra; al terminar, si llegaron mensajes durante la corrida, se reprograma una
    única corrida de seguimiento.
  - El agente, al correr, **relee el historial de la BD** (ya lo hace): toma todos los mensajes
    acumulados → respuesta coherente única (coalescencia natural).
  - El disparo desde `ingest.ts` pasa a llamar `scheduleAgentRun(orgId, convId)` (de `coalesce.ts`)
    en vez de `runAgentForInboundMessage` directo, dentro del mismo `after()`.
- **Razón**: Resuelve respuestas solapadas/condiciones de carrera (US3/FR-008/009) con un patrón
  simple y sin infraestructura nueva. La relectura de BD garantiza que la coalescencia no pierda
  mensajes y **preserva la idempotencia** (el gate insert-nuevo + UNIQUE sigue intacto; el debounce
  solo agrupa el *cuándo* se corre, no *qué* se inserta).
- **Alternativas descartadas**:
  - *Lock/cola compartida (Redis o advisory lock de Postgres)*: más robusto ante múltiples instancias,
    pero el MVP corre **una** instancia en Coolify; se documenta como camino de escala (Complexity
    Tracking).
  - *Procesar cada mensaje y confiar en el historial*: produce N respuestas por ráfaga (lo que se
    quiere evitar).
  - *Responder solo al último mensaje*: descartado en el clarify (puede perder matices de los
    intermedios).
- **Supuesto explícito**: **instancia única** del servidor (Coolify, MVP). Si en el futuro se escala
  horizontalmente, el debounce/lock debe migrar a un store compartido.

## RB-4 — **Degradación visible** ante fallo del proveedor de IA

- **Decisión**: En el `catch` de `runAgentForInboundMessage`, además del `console.error` **sin
  secretos** (ya está), marcar `needs_human = true` con `needs_human_reason = 'ai_error'` para esa
  conversación y **no** enviar ni registrar respuesta. La bandeja muestra el motivo.
- **Razón**: Convierte el fallo silencioso (US4) en señal accionable (FR-012/013) sin romper la
  bandeja (el resto sigue). No se reporta envío inexistente (FR-003/012).
- **Alternativas descartadas**:
  - *Reintentar automáticamente*: puede duplicar respuestas y enmascarar fallos persistentes; para el
    MVP es preferible ceder a humano. (Reintentos con backoff = mejora futura.)
  - *Solo loguear (estado actual)*: deja al cliente sin respuesta y al asesor sin enterarse.

## RB-5 — **Motivo** de atención humana como enum aditivo

- **Decisión**: Añadir `conversation.needs_human_reason` como `pgEnum`
  (`requested | out_of_window | uninterpretable | ai_error`), **nullable** (null cuando
  `needs_human=false`). El handoff existente de 004 (petición explícita / acción del modelo) setea
  `'requested'`. La bandeja deriva la **etiqueta visible por motivo** de este campo. Reanudar el
  agente (`/agent { resume:true }`) limpia `needs_human` **y** `needs_human_reason`.
- **Razón**: Cumple el clarify (etiqueta distinta por motivo) con **una columna aditiva**, sin tablas
  nuevas; el enum mantiene los valores acotados y tipados (consistente con el resto del esquema).
- **Alternativas descartadas**:
  - *Columna de texto libre*: pierde el tipado/acotamiento; riesgo de valores inconsistentes.
  - *Tabla de eventos de conversación*: sobre-ingeniería para v1; el último motivo basta para la
    señal.
  - *Una etiqueta genérica (sin motivo)*: descartado en el clarify.

## RB-6 — Sin dependencias nuevas; **una env opcional**

- **Decisión**: No se añaden librerías. Se agrega `AGENT_COALESCE_MS` a `src/lib/env.ts`
  (numérica, **opcional**, default ~6000), coherente con el patrón de degradación de la app (envs de
  IA ya son opcionales: si falta, default). El timeout del proveedor de IA ya lo maneja
  `openrouter.ts`.
- **Razón**: Mantiene el footprint mínimo y permite al dueño ajustar la espera de coalescencia sin
  redeploy de código.
- **Alternativas descartadas**: *constante hardcodeada* (menos flexible para tunear en producción).

## RB-7 — Estrategia de **self-test** de los cuatro casos

- **Decisión**: `scripts/wa-tester/agent-robustness.mjs` (reusa el guardrail de allowlist + anti-ráfaga
  de Evolution) cubre:
  - **Fuera de ventana**: difícil de esperar 24 h en vivo → **simular** envejeciendo el `wa_timestamp`
    del último entrante en la BD de prueba (>24 h) y disparar un nuevo entrante; verificar que **no**
    sale texto del agente y que la conversación queda `needs_human/out_of_window`.
  - **No-texto**: enviar una **nota de voz**/imagen vía Evolution; verificar respuesta determinista
    pidiendo texto + `message.wa_type` persistido + señal en bandeja; repetir no-texto → handoff
    `uninterpretable`.
  - **Ráfaga**: enviar 3 mensajes en <`AGENT_COALESCE_MS`; verificar **una sola** respuesta coherente
    y requisitos consistentes.
  - **Fallo de IA**: forzar fallo (clave inválida temporal / modelo inexistente vía env de prueba);
    verificar `needs_human/ai_error`, **0** envíos y bandeja operativa.
- **Razón**: El cierre del sprint es comportamiento real (metodología). Cada caso es verificable de
  forma reproducible.
- **Alternativas descartadas**: *solo typecheck/lint/build* (no demuestra el comportamiento, que es el
  punto de esta feature); *esperar 24 h reales* (inviable; se simula por timestamp).

---

## Resumen de decisiones

| ID | Tema | Decisión |
|----|------|----------|
| RB-1 | Ventana 24 h | Chequeo server-side antes de enviar; fuera → no envía + `out_of_window` |
| RB-2 | No-texto | Persistir `wa_type`; respuesta determinista pide texto; escalar si insiste |
| RB-3 | Ráfaga | Debounce + lock en memoria por conversación; relee BD (idempotente); instancia única |
| RB-4 | Fallo IA | `catch` marca `needs_human/ai_error`, sin envío, sin secretos |
| RB-5 | Motivo | `conversation.needs_human_reason` enum aditivo; reanudar lo limpia |
| RB-6 | Deps/env | Sin libs nuevas; `AGENT_COALESCE_MS` opcional (default ~6000) |
| RB-7 | Self-test | Script que simula los 4 casos vía Evolution + ajuste de timestamp |
