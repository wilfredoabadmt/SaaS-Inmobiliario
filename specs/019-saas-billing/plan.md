# Implementation Plan: Multi-Tenant SaaS Subscriptions & Billing (019-saas-billing)

## 1. Arquitectura y Esquema
1. **Base de Datos**:
   - Agregar tabla `subscription` en `src/lib/db/schema/domain.ts` con foreign key a `organization(id)`.
   - Generar migración SQL `drizzle/0013_saas_subscription.sql` y actualizar `drizzle/meta/_journal.json`.
   - Añadir generador de id `sub_` en `src/lib/db/ids.ts`.

2. **Tipos y Constantes de Planes**:
   - Crear `src/lib/billing/plans.ts`:
     - Definición de planes: `starter`, `pro`, `enterprise`.
     - Definición de límites: `properties` (10 / 50 / Infinity), `members` (2 / 5 / Infinity), `aiVoiceNotes` (false / true / true), `automatedReminders` (false / true / true).
     - Precios y metadatos para checkout.

3. **Lógica de Servicio y Cuotas**:
   - Crear `src/server/billing/service.ts`:
     - `getOrganizationSubscription(organizationId)`
     - `upsertSubscription(organizationId, data)`
     - `getOrganizationUsage(organizationId)`: calcula recuento real de propiedades activas y miembros.
     - `checkPlanLimits(organizationId, resource: "properties" | "members")`
     - `assertPlanLimits(organizationId, resource: "properties" | "members")`

4. **Protección en Endpoints Existentes**:
   - `src/app/api/properties/route.ts`: llamar a `assertPlanLimits(organizationId, "properties")` antes de crear.
   - `src/app/api/team/invitations/route.ts`: llamar a `assertPlanLimits(organizationId, "members")` antes de crear.

5. **Rutas de Facturación y Webhooks**:
   - `src/app/api/billing/subscription/route.ts`: GET devuelve suscripción actual, plan, uso de cuotas y límites.
   - `src/app/api/billing/checkout/route.ts`: POST crea sesión de checkout o simula cambio de plan en modo self-hosted.
   - `src/app/api/billing/portal/route.ts`: POST crea sesión de portal o devuelve status.
   - `src/app/api/webhooks/stripe/route.ts`: POST procesa eventos de Stripe con verificación de firma e idempotencia.

6. **Interfaz de Usuario**:
   - Añadir tarjeta "Facturación" a `src/app/(dashboard)/settings/page.tsx` (`ownerOnly: true`).
   - Crear `src/app/(dashboard)/settings/billing/page.tsx` (SSR con guard `requireOwner`).
   - Crear `src/components/billing/billing-view.tsx` con barras de progreso de cuotas, estado del plan, tarjetas de comparación y trigger de actualización.
