# Implementation Plan: Robustez y modo híbrido confiable del agente de IA

**Branch**: `005-robustez-agente` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-robustez-agente/spec.md`

## Summary

Endurecer el agente de IA de la feature 004 para que **nunca falle en silencio**. Cuatro frentes,
todos sobre el flujo existente (webhook → `ingest.ts` → `after()` → `agent.ts` → `send.ts`):

1. **Ventana de 24 h** (US1): antes de enviar texto libre, el agente verifica server-side la ventana
   (a partir del último entrante). Fuera de ventana → **no envía**, marca `needs_human` con motivo
   `out_of_window` y **no** reporta envío.
2. **Mensajes no-texto** (US2): el disparo deja de exigir texto. Ante audio/imagen/ubicación/etc., el
   sistema responde **determinísticamente** (sin LLM) pidiendo texto dentro de ventana y persiste el
   **tipo** del mensaje para que la bandeja lo muestre; si el cliente **insiste** con no-texto o pide
   humano → handoff con motivo `uninterpretable`. El soporte real multimodal es otra feature.
3. **Ráfaga** (US3): el disparo ya no llama al agente directo; **coalesce** por conversación con un
   *debounce* corto (en memoria) + *lock* serializado. Al disparar, el agente lee el historial
   acumulado de la BD (coalescencia natural). Preserva la idempotencia (gate insert-nuevo + UNIQUE).
4. **Degradación visible** (US4): el `catch` de `agent.ts` deja de ser solo `console.error`: marca
   `needs_human` con motivo `ai_error`, sin enviar nada y sin secretos en logs.

Soporte transversal: una columna `conversation.needs_human_reason` (enum) hace que la bandeja
distinga **por qué** una conversación requiere atención humana (decisión del clarify). No hay
acciones de negocio nuevas; es robustez del agente existente.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Next.js 15
(App Router, `after()` para trabajo post-respuesta), React 19.

**Primary Dependencies**: Sin dependencias nuevas. Reusa `src/lib/ai/openrouter.ts` (adaptador IA),
`src/lib/meta` (envío WhatsApp + tipos del webhook entrante), Drizzle ORM + PostgreSQL, Zod. El
*debounce/lock* de ráfaga es un módulo propio en memoria (sin Redis en el MVP).

**Storage**: PostgreSQL self-hosted. **Migración aditiva**: `conversation.needs_human_reason`
(enum, nullable) + `message.wa_type` (text, nullable). Sin tablas nuevas, sin alterar datos.

**Testing**: typecheck + lint + build (puerta mínima, Principio V) **+ self-test de comportamiento**
(metodología): conversación como cliente vía Evolution↔número de prueba que corrobora SC-001…SC-007
(quickstart). El guardrail de allowlist de Evolution aplica.

**Target Platform**: Web/servidor Next.js en Coolify (`next start` long-running; `after()` corre
post-respuesta). **Instancia única** en el MVP (supuesto que habilita el debounce/lock en memoria).
WhatsApp Cloud API como canal. Español MX.

**Project Type**: Web app monolítica (Next.js App Router, single project).

**Performance Goals**: La respuesta del agente sigue en pocos segundos; la **coalescencia** añade una
espera corta acotada (env `AGENT_COALESCE_MS`, default ~6 s) que el dueño puede ajustar. El fallo de
IA se resuelve rápido (timeout ya existente del adaptador) y degrada sin colgar la bandeja.

**Constraints**: No enviar texto libre fuera de la ventana 24 h (FR-001/002); no reportar envíos que
no salieron (FR-003/012); idempotencia preservada bajo ráfaga (FR-010/SC-005); aislamiento de tenant
en todo el flujo (FR-011/017); secreto de IA fuera de cliente y logs (FR-014, Principio I); no
inventar contenido de no-texto (FR-006).

**Scale/Scope**: Decenas a bajos cientos de propiedades por tenant; volumen de mensajes de una
agencia chica. 2 columnas nuevas, 1 módulo de coalescencia, cambios en `ingest.ts`/`agent.ts`/
`send.ts`/`queries.ts` y señales nuevas en la UI de bandeja. 1 env nueva opcional.

## Constitution Check

*GATE: pasa antes de Fase 0; se re-evalúa tras Fase 1.*

| Principio | Aplica | Cumplimiento en esta feature |
|-----------|--------|------------------------------|
| I. Seguridad de Datos Primero | Sí | El `catch` de fallo de IA registra **sin secretos** ni datos de otro tenant (FR-014); la clave de IA sigue en env. Ningún secreto al cliente. |
| II. Soberanía / Self-Hosted | Sí (sin cambio) | No agrega integraciones externas; reusa la IA ya aislada tras `lib/ai` (D1 de 004). El debounce/lock es in-process, sin terceros. |
| III. Multi-Tenancy Real | Sí (central) | Ventana, no-texto, ráfaga y fallo se resuelven **por conversación con scope de tenant**; el motivo y el tipo de mensaje se escriben en filas del tenant. |
| IV. Idempotencia | Sí (central) | La coalescencia **no** rompe el gate insert-nuevo + UNIQUE `wa_message_id`: el debounce relee la BD; un reintento del webhook no agrega procesamiento ni respuesta (SC-005). |
| V. Calidad Verificable | Sí | "Hecho" = typecheck + lint + build **+ self-test** que corrobora SC-001…SC-007; lo no verificable se marca pendiente. |
| VI. Specs Antes de Código | Sí | spec.md (clarificado) precede a este plan; el código sigue a tasks. |
| VII. Trazabilidad | Sí | Decisiones RB-1…RB-7 en research.md; supuestos (instancia única, debounce en memoria, no-texto interim) explícitos. |
| VIII. Foco Vertical Inmobiliario | Sí | Robustece la atención del asesor inmobiliario; no genera contratos ni cambia el dominio. |

**Resultado**: PASS. La única desviación a registrar es el *lock/debounce en memoria* (supone
instancia única); se documenta en Complexity Tracking, no es violación constitucional.

**Re-evaluación post-Fase 1**: PASS — el diseño mantiene scope de tenant, idempotencia (relectura de
BD al coalescer), degradación sin secretos y migración aditiva. Sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/005-robustez-agente/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones RB-1…RB-7
├── data-model.md        # Fase 1: 2 columnas nuevas + transiciones de estado
├── quickstart.md        # Fase 1: cómo verificar (incl. self-test de los 4 casos)
├── contracts/
│   ├── requirements.md  # (ya existe) calidad del spec — checklist
│   └── agent-robustness.md  # Fase 1: contrato de comportamiento del agente endurecido
└── tasks.md             # Fase 2: lo genera /speckit-tasks (NO aquí)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── env.ts                       # MODIFICA: + AGENT_COALESCE_MS (opcional, default ~6000)
│   ├── db/schema/domain.ts          # MODIFICA: conversation.needs_human_reason (enum) + message.wa_type
│   ├── meta/index.ts                # LEE: tipo del mensaje entrante (type) del WhatsAppChangeValue
│   └── inbox/types.ts               # MODIFICA: needsHumanReason en ConversationListItem; waType en MessageItem
├── server/
│   ├── ai/
│   │   ├── agent.ts                 # MODIFICA: verificar ventana 24h antes de enviar; catch → needs_human(ai_error); set reason en handoff
│   │   ├── prompts.ts               # (sin cambio funcional; revisar si conviene una nota de no-texto)
│   │   └── coalesce.ts              # NUEVO: debounce + lock por conversación (in-memory, instancia única)
│   ├── inbox/
│   │   ├── ingest.ts                # MODIFICA: no exigir texto; no-texto → respuesta determinista + señal; disparo vía coalesce.ts
│   │   ├── send.ts                  # MODIFICA/EXTIENDE: helper de respuesta determinista (pedir texto); helper de ventana 24h
│   │   └── queries.ts               # MODIFICA: surtir needs_human_reason y el tipo del último mensaje a la bandeja
│   └── conversations/               # (la ruta /agent existe; resume limpia needs_human → también el reason)
├── app/api/conversations/[id]/
│   └── agent/route.ts               # MODIFICA: al reanudar (resume) limpiar needs_human Y needs_human_reason
└── components/inbox/
    ├── inbox-client.tsx             # MODIFICA: badge "requiere atención humana" con etiqueta por motivo en la lista
    └── chat-thread.tsx              # MODIFICA: cabecera muestra el motivo; render del último entrante no-texto (ej. "🎤 nota de voz")

drizzle/                              # NUEVO: migración aditiva (needs_human_reason + wa_type)
scripts/wa-tester/
└── agent-robustness.mjs             # NUEVO: self-test de los 4 casos (fuera de ventana, no-texto, ráfaga, fallo IA)
```

**Structure Decision**: Web app monolítica de Next.js (App Router), un solo proyecto. La robustez se
concentra en el **borde de ingest/agente** (`src/server/inbox` + `src/server/ai`), reutilizando el
adaptador `lib/ai` y `lib/meta` sin tocarlos en su frontera. La UI reutiliza la bandeja de 003/004,
solo añade la **etiqueta por motivo** y el render del último entrante no-texto. **No se toca** auth,
el contrato del webhook de Meta (firma/idempotencia) ni el matching de 004.

## Decisiones de alcance y trazabilidad (Principio VII)

- **Fuera de ventana → ceder a humano** (clarify): sin auto-texto ni auto-plantilla; el asesor manda
  plantilla a mano (capacidad de 001). Auto-reenganche por plantilla = fuera de v1.
- **No-texto interim** (clarify): respuesta determinista pidiendo texto + persistir el tipo (visible
  en bandeja); escalar a handoff si insiste. El soporte real de audio/imagen es una **feature de
  agente multimodal** dedicada (próxima).
- **Coalescencia con debounce en memoria** (clarify): instancia única en el MVP; el camino de escala
  (lock compartido en BD/Redis) se documenta como trabajo futuro (Complexity Tracking).
- **Motivo de atención humana** como enum en `conversation`: una sola columna aditiva resuelve la
  etiqueta por motivo sin tablas nuevas.

## Complexity Tracking

> Se registra la única desviación a evaluar: *lock/debounce de ráfaga en memoria*.

| Violación potencial | Por qué se necesita | Alternativa más simple rechazada porque |
|----------------------|---------------------|------------------------------------------|
| Coalescencia de ráfaga con estado **en memoria** (debounce + lock por conversación) | Evita respuestas solapadas/condiciones de carrera sin añadir infraestructura (Redis) al MVP; el VPS corre **una** instancia | Un lock compartido (Redis/Postgres advisory lock) es más robusto ante múltiples instancias, pero excede el MVP de instancia única; se deja documentado como camino de escala. Persistir la coalescencia en BD añade complejidad sin beneficio con 1 instancia. |
