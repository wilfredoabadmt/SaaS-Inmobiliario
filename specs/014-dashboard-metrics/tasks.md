# Tasks: Métricas Reales en Tablero de Inicio (014-dashboard-metrics)

## Phase 1 — Queries & Data Layer
- [x] T001 Crear módulo de consultas del dashboard con aislamiento de tenant en `src/server/dashboard/queries.ts` (`getDashboardKpis`, `getSlaBreachedCount`, `getUpcomingVisits`, `getRecentActivity`)
- [x] T002 Definir tipos de retorno para las vistas del dashboard en `src/server/dashboard/types.ts`

## Phase 2 — Componentes y Vistas
- [x] T003 Actualizar `src/components/dashboard/sla-banner.tsx` para manejar count = 0 y enlaces directos a `/inbox`
- [x] T004 Modificar `src/components/dashboard/dashboard-view.tsx` para recibir datos por props y eliminar las dependencias de `SAMPLE_*` en producción

## Phase 3 — Integración en Página y Verificación
- [x] T005 Conectar `src/app/(dashboard)/inicio/page.tsx` para ejecutar las consultas server-side bajo `requireMember()`
- [x] T006 Pasar el gate técnico de calidad: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
