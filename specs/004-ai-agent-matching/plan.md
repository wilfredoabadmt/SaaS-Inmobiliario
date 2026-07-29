# Implementation Plan: Agente de IA conversacional + matching propiedad↔cliente

**Branch**: `004-ai-agent-matching` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-ai-agent-matching/spec.md`

## Summary

Convertir la bandeja de WhatsApp en un **asesor inmobiliario con IA**. Dos capacidades núcleo:
(1) **matching real** propiedad↔cliente —un nuevo modelo de *requisitos del cliente* + un motor de
afinidad (filtro/score determinista + ranking/explicación con `deepseek/deepseek-v4-pro`)— que
reemplaza los datos de muestra del panel "Matching en vivo" de la feature 003; y (2) un **agente
conversacional** (`deepseek/deepseek-v4-flash` vía OpenRouter) que, **opt-in por conversación** y en
modo **híbrido**, responde al cliente, lo **califica** (extrae sus requisitos), **envía la mejor
ficha**, **agenda visitas** y hace **handoff** a un humano en el cierre/temas sensibles.

Enfoque técnico (ver research.md):
- **IA aislada** tras `src/lib/ai/openrouter.ts` (D1); modelos y clave por env.
- **Matching** (D2) en `src/server/matching/`: filtro duro + score → top-N → ranking/explicación IA,
  cacheado por versión de requisitos; alimenta el panel y la acción "enviar ficha".
- **Agente** (D3) en `src/server/ai/agent.ts`: una llamada con salida JSON (reply + requirements +
  action); el **servidor** ejecuta las acciones (guardar requisitos, enviar ficha, crear visita,
  handoff). Se dispara desde el webhook entrante (D4) tras el insert idempotente, vía `after()`.
- **Datos** (D5): tabla `client_requirements` + flags `conversation.ai_enabled/needs_human` +
  `message.ai_generated`. Migración Drizzle aditiva.
- **UI**: toggle del agente y señal de "requiere atención humana" en la bandeja; mensajes del agente
  distinguidos; panel de matching con datos reales.

## Technical Context

**Language/Version**: TypeScript estricto (`strict` + `noUncheckedIndexedAccess`), Next.js 15.1
(App Router, `after()` para trabajo post-respuesta), React 19.

**Primary Dependencies**: OpenRouter (Chat Completions, formato compatible OpenAI) vía `fetch` tras
un adaptador propio; Drizzle ORM + PostgreSQL; Zod (validación del JSON del modelo y de inputs);
`lib/meta` (envío WhatsApp ya existente, con normalización MX). Sin SDK de proveedor (D1).

**Storage**: PostgreSQL self-hosted. **Migración aditiva**: tabla `client_requirements`; columnas
`conversation.ai_enabled`, `conversation.needs_human`, `message.ai_generated`.

**Testing**: typecheck + lint + build (puerta mínima, Principio V) **+ self-test de comportamiento**
(paso añadido a la metodología): conversación como cliente vía Evolution↔número de prueba que
corrobora SC-001…SC-006 (research D9).

**Target Platform**: Web/servidor Next.js en Coolify (long-running `next start`; `after()` corre
post-respuesta). WhatsApp Cloud API como canal. Español MX.

**Project Type**: Web app monolítica (Next.js App Router, single project).

**Performance Goals**: Respuesta del agente en pocos segundos tras el mensaje; panel de matching sin
recomputar IA en cada poll (caché por versión de requisitos). Coste por conversación bajo (modelos
baratos + prompts acotados, D10).

**Constraints**: No inventar inventario/precios (FR-008/SC-004); no generar contratos (FR-016,
Principio VIII); ventana 24 h (FR-015); idempotencia (FR-009); aislamiento multi-tenant (FR-017);
secreto de IA fuera de cliente/logs (FR-018, Principio I); degradación ante fallo de IA (FR-019).

**Scale/Scope**: Inventario de decenas a bajos cientos de propiedades por tenant. 1 tabla nueva, 3
columnas, 1 adaptador de IA, 1 motor de matching, 1 loop de agente, ~3 endpoints (toggle agente,
requisitos, recompute matches), ajustes de UI en la bandeja.

## Constitution Check

*GATE: pasa antes de Fase 0; se re-evalúa tras Fase 1.*

| Principio | Aplica | Cumplimiento en esta feature |
|-----------|--------|------------------------------|
| I. Seguridad de Datos Primero | Sí | La clave de OpenRouter vive en env, nunca se expone al cliente ni a logs (FR-018). El modelo recibe solo datos del tenant de la conversación; el servidor ejecuta las acciones (el modelo no toca la BD). |
| II. Soberanía / Self-Hosted | Sí (con nota) | Auth y BD siguen self-hosted. La IA es una **integración externa inevitable** (como WhatsApp), **aislada tras un adaptador** `lib/ai` (D1); no es función core. Portable a otro proveedor/clave sin tocar el dominio. Ver Complexity Tracking. |
| III. Multi-Tenancy Real | Sí (central) | Requisitos, inventario, matches, visitas y estado del agente se consultan **con scope de tenant**; el prompt solo incluye datos del tenant de la conversación. |
| IV. Idempotencia | Sí (central) | El agente se dispara solo cuando el insert del entrante fue **nuevo** (UNIQUE `wa_message_id` + returning); un reintento del webhook no genera segunda respuesta (FR-009/SC-005). |
| V. Calidad Verificable | Sí | "Hecho" = typecheck + lint + build **+ self-test de comportamiento** que corrobora los SC; lo no verificable se marca pendiente de verificación humana. |
| VI. Specs Antes de Código | Sí | spec.md aprobado precede a este plan; el código sigue a tasks. |
| VII. Trazabilidad | Sí | Decisiones D1–D10 en research.md; supuestos (presupuesto blando, solo texto, caché) explícitos. |
| VIII. Foco Vertical Inmobiliario | Sí (central) | El agente informa/califica/matchea/agenda para una agencia inmobiliaria; **no genera ni firma contratos** (FR-016). El matching propiedad↔cliente es el diferencial del dominio. |

**Resultado**: PASS. La dependencia de IA externa se registra en Complexity Tracking (justificada y
aislada), no es violación de soberanía (no es función core).

**Re-evaluación post-Fase 1**: PASS — el diseño mantiene la IA tras un adaptador, el scope de tenant
en todo el flujo, la idempotencia en el disparo y la prohibición de contratos. Sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/004-ai-agent-matching/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones D1–D10
├── data-model.md        # Fase 1: entidades nuevas/extendidas
├── quickstart.md        # Fase 1: cómo verificar (incl. self-test por WhatsApp)
├── contracts/
│   └── ai-agent.md      # Fase 1: contrato del agente, matching, endpoints y JSON del modelo
├── checklists/
│   └── requirements.md  # (ya existe) calidad del spec
└── tasks.md             # Fase 2: lo genera /speckit-tasks (NO aquí)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── ai/
│   │   └── openrouter.ts          # NUEVO: adaptador OpenRouter (chat, chatJson<T>) + config de modelos
│   ├── env.ts                     # MODIFICA: + OPENROUTER_API_TOKEN, OPENROUTER_*_MODEL, OPENROUTER_BASE_URL
│   ├── db/schema/domain.ts        # MODIFICA: tabla client_requirements + flags conversation/message
│   └── inbox/types.ts             # MODIFICA: requisitos/matches/estado del agente reales (no muestra)
├── server/
│   ├── matching/
│   │   └── engine.ts              # NUEVO: filtro+score determinista → top-N → ranking/explicación IA (cache)
│   ├── ai/
│   │   ├── agent.ts               # NUEVO: arma prompt, llama v4-flash, valida JSON, ejecuta acciones
│   │   └── prompts.ts             # NUEVO: system prompt del asesor (tono, reglas, handoff)
│   ├── inbox/
│   │   ├── ingest.ts              # MODIFICA: dispara el agente tras insert nuevo (gated), vía after()
│   │   └── queries.ts             # MODIFICA: surte requisitos + matches reales + estado del agente
│   ├── requirements/
│   │   └── service.ts             # NUEVO: upsert/merge de client_requirements + versión
│   └── showings/
│       └── service.ts             # NUEVO/extiende: crear visita desde el agente (US4)
├── app/
│   ├── api/
│   │   └── conversations/[id]/
│   │       ├── agent/route.ts     # NUEVO: POST activar/desactivar agente; reanudar handoff (owner/agent)
│   │       └── requirements/route.ts # NUEVO: GET/PUT requisitos del cliente (asesor edita)
│   └── (dashboard)/inbox/page.tsx # MODIFICA: pasa estado del agente + matches reales al cliente
└── components/inbox/
    ├── chat-thread.tsx            # MODIFICA: toggle del agente + badge "requiere atención humana" + msg de IA
    ├── inbox-client.tsx           # MODIFICA: señal de handoff en la lista; matches reales en el panel
    └── matching-panel.tsx         # MODIFICA: consume matches reales (mismo contrato visual de 003)

drizzle/                            # NUEVO: migración aditiva (client_requirements + columnas)
scripts/wa-tester/
└── agent-roundtrip.mjs            # NUEVO: self-test — seed fixtures + conversar como cliente + verificar
```

**Structure Decision**: Web app monolítica de Next.js (App Router), un solo proyecto. La IA se
concentra en `src/lib/ai` (adaptador) y `src/server/{ai,matching,requirements}` (lógica de dominio),
desacoplada de la UI. El disparo vive en el webhook/ingest existente. La UI reutiliza los
componentes de la bandeja de 003 (el panel de matching solo cambia de fuente: muestra → real). **No
se toca** auth ni el contrato del webhook de Meta (firma/idempotencia se preservan).

## Decisiones de alcance y trazabilidad (Principio VII)

- **Self-test como cierre**: el sprint no se declara hecho hasta corroborar el comportamiento del
  agente conversando como cliente (SC-008, research D9) — paso añadido a la metodología.
- **Matching híbrido** (no solo-IA) para evitar alucinaciones de inventario/% y controlar coste; la
  IA aporta el matiz y la explicación (D2).
- **Solo texto** en v1 (audio/imagen/ubicación → handoff o respuesta genérica).
- **Clave de IA a nivel plataforma** (env) en MVP; per-tenant es trabajo posterior.
- **Reutiliza el inventario real**; para el self-test se siembran propiedades de prueba (fixtures).

## Complexity Tracking

> Se registra la única desviación a evaluar: dependencia de un servicio de IA externo.

| Violación potencial | Por qué se necesita | Alternativa más simple rechazada porque |
|----------------------|---------------------|------------------------------------------|
| Dependencia de IA externa (OpenRouter) | El diferencial del producto es atención + matching con IA; no hay LLM self-hosted viable en el VPS del MVP | Self-hostear un LLM capaz excede los recursos del MVP. Se mitiga aislándolo tras `lib/ai` (portable) y manteniendo core (auth/DB) self-hosted — coherente con Principio II (integración externa tras frontera, como WhatsApp). |
