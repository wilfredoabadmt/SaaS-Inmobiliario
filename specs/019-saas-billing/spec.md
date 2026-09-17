# Spec: Multi-Tenant SaaS Subscriptions & Billing (019-saas-billing)

## 1. Contexto y Objetivos
Homya es una plataforma SaaS multi-tenant para agencias inmobiliarias. Para monetizar y controlar el consumo de recursos de cada agencia (`organization_id`), se requiere un sistema de suscripción y facturación por niveles (tiers):
1. **Starter** (Plan Base / Gratuito):
   - Hasta 10 propiedades activas.
   - Hasta 2 miembros de equipo (Owner + 1 Asesor).
   - Funcionalidades básicas de WhatsApp CRM.
2. **Pro** (Plan Crecimiento):
   - Hasta 50 propiedades activas.
   - Hasta 5 miembros de equipo.
   - Transcripción de notas de voz con IA (STT).
   - Recordatorios automáticos de visitas por WhatsApp.
   - Analítica avanzada de plantillas y métricas.
3. **Enterprise** (Plan Ilimitado):
   - Propiedades ilimitadas.
   - Miembros de equipo ilimitados.
   - Modelos de IA con cuota prioritaria.
   - Soporte dedicado.

## 2. Requerimientos Funcionales
- **FR-001 (Esquema de Suscripción)**: Tabla `subscription` asociada a `organization_id` con `plan`, `status` (`active`, `past_due`, `canceled`, `trialing`), `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`, `cancelAtPeriodEnd`.
- **FR-002 (Control de Cuotas)**: Servicio `checkPlanLimits` y `assertPlanLimits` que valida el inventario de propiedades activas y el número de miembros/invitaciones del tenant según su plan.
- **FR-003 (Enforcement en APIs)**:
  - `POST /api/properties`: Bloquea con `403 Forbidden` (`code: "plan_limit_reached"`) si se supera el cupo de propiedades del plan.
  - `POST /api/team/invitations`: Bloquea con `403 Forbidden` (`code: "plan_limit_reached"`) si el equipo supera los asientos permitidos.
- **FR-004 (Portal y Checkout de Facturación)**:
  - Endpoints `/api/billing/subscription`, `/api/billing/checkout`, y `/api/billing/portal`.
  - Integración nativa con Stripe cuando las variables de entorno están presentes (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
  - Modo simulación / self-hosted para desarrollo y despliegues sin Stripe activo.
- **FR-005 (Webhook Idempotente)**: `/api/webhooks/stripe` para escuchar eventos `checkout.session.completed`, `customer.subscription.updated`, y `customer.subscription.deleted`.
- **FR-006 (UI de Facturación)**: Vista en `/settings/billing` accesible solo para el `owner`, mostrando plan actual, progreso de cuotas (propiedades, asientos), comparativa de planes y botón de cambio de plan o gestión de suscripción.

## 3. Principios de la Constitución Aplicados
- **Principio II (Multi-tenancy estricto)**: Toda consulta y mutación de suscripción filtra y pertenece a `organization_id`.
- **Principio IV (Idempotencia)**: El webhook de Stripe y la actualización de suscripciones son idempotentes por `stripeSubscriptionId` y timestamp.
- **Principio V (Quality Gates)**: Cobertura estricta con TypeScript, pruebas unitarias y verificación de compilación.
