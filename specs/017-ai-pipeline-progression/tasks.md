# Tasks: Movimiento Agéntico del Pipeline por IA (017-ai-pipeline-progression)

## Phase 1 — Pipeline Stage Helpers
- [x] T001 Implementar `resolveStageByKindOrLabel` y `advanceClientDeal` en `src/server/pipeline/stages.ts`

## Phase 2 — Integración en Envío y Agente IA
- [x] T002 Conectar auto-avance a "Contactado" en `src/app/api/conversations/[id]/messages/route.ts`
- [x] T003 Ampliar `ACTION_TYPES` y prompt del agente con acción `advance_stage` en `src/server/ai/agent.ts` y `src/server/ai/prompts.ts`
- [x] T004 Conectar auto-avance a "Calificado" y ejecución de `advance_stage` en `src/server/ai/agent.ts`

## Phase 3 — Verificación
- [x] T005 Pasar el gate técnico de calidad: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
