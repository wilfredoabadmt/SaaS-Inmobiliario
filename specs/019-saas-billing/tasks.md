# Tasks: Multi-Tenant SaaS Subscriptions & Billing (019-saas-billing)

## Phase 1 — Schema & Database Migration
- [x] T001 Agregar tabla `subscription` en `src/lib/db/schema/domain.ts` y generador `sub_` en `src/lib/db/ids.ts`
- [x] T002 Crear migración `drizzle/0013_saas_subscription.sql` y actualizar `drizzle/meta/_journal.json`

## Phase 2 — Configuración de Planes y Servicio de Límites
- [x] T003 Definir planes, cuotas y características en `src/lib/billing/plans.ts`
- [x] T004 Implementar servicio de suscripción y límites en `src/server/billing/service.ts`
- [x] T005 Proteger creación de propiedades en `src/app/api/properties/route.ts` con `assertPlanLimits`
- [x] T006 Proteger invitaciones de equipo en `src/app/api/team/invitations/route.ts` con `assertPlanLimits`

## Phase 3 — Rutas API de Facturación y Webhooks
- [x] T007 Implementar `GET /api/billing/subscription`
- [x] T008 Implementar `POST /api/billing/checkout` y `POST /api/billing/portal` (soporte Stripe + fallback dev)
- [x] T009 Implementar `POST /api/webhooks/stripe` con soporte para webhook idempotente

## Phase 4 — Interfaz de Usuario
- [x] T010 Añadir acceso a Facturación en `src/app/(dashboard)/settings/page.tsx`
- [x] T011 Crear componente interactivo `src/components/billing/billing-view.tsx`
- [x] T012 Crear página SSR `src/app/(dashboard)/settings/billing/page.tsx`

## Phase 5 — Verificación y Calidad
- [x] T013 Escribir pruebas unitarias para límites y planes en `tests/foundational/billing.test.ts`
- [x] T014 Ejecutar el gate técnico completo: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
