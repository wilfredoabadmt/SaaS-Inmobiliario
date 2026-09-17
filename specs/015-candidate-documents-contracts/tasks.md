# Tasks: Expedientes y Contratos (015-candidate-documents-contracts)

## Phase 1 — Schemas & Services
- [x] T001 Crear esquemas Zod de validación en `src/lib/documents/schemas.ts` y `src/lib/contracts/schemas.ts`
- [x] T002 Implementar servicio de documentos de candidatos en `src/server/documents/service.ts`
- [x] T003 Implementar servicio de contratos en `src/server/contracts/service.ts`

## Phase 2 — Endpoints de API
- [x] T004 Implementar endpoints de documentos `/api/candidacies/[id]/documents` (listar, sign, confirm, delete)
- [x] T005 Implementar endpoints de contratos `/api/candidacies/[id]/contracts` (listar, sign, confirm, patch status, delete)

## Phase 3 — Componentes de UI e Integración
- [x] T006 Crear componente `src/components/documents/candidate-documents-panel.tsx`
- [x] T007 Crear componente `src/components/contracts/contract-tracker.tsx`
- [x] T008 Integrar secciones de Documentos y Contratos en el panel lateral del trato `src/components/pipeline/deal-drawer.tsx`

## Phase 4 — Verificación
- [x] T009 Pasar el gate técnico de calidad: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
