# Plan Técnico: Métricas Reales en Tablero de Inicio (014-dashboard-metrics)

## 1. Constitution Check

- **Principio I (Seguridad de datos)**: Todas las consultas aplican `organization_id` indexado. Ningún dato de otra organización se computa en los KPIs.
- **Principio II (Soberanía / Self-Hosted)**: Sin servicios analíticos externos de terceros; todas las métricas se computan directamente sobre PostgreSQL mediante Drizzle ORM.
- **Principio III (Multi-Tenancy)**: El contexto de la sesión (`requireMember`) provee el `organizationId`.
- **Principio V (Calidad Verificable)**: `pnpm typecheck`, `pnpm lint`, `pnpm build` limpios y sin advertencias.
- **Principio VIII (Foco Inmobiliario)**: Los KPIs reflejan el ciclo inmobiliario real: prospectos, visitas a propiedades, conversaciones y tratos ganados.

---

## 2. Consultas de Base de Datos (`src/server/dashboard/queries.ts`)

### 2.1. `getDashboardKpis(orgId: string)`
- **Leads nuevos**: Conteo de `client` donde `created_at >= now() - interval '7 days'`.
- **Conversaciones activas**: Conteo de `conversation` donde `updated_at >= now() - interval '7 days'`.
- **Visitas esta semana**: Conteo de `showing` donde `status IN ('agendada', 'realizada')` y `scheduled_at` está dentro de la semana corriente.
- **Cierres del mes**: Conteo de `candidacy` unida a `pipeline_stage` donde `kind = 'won'` y `candidacy.updated_at` está dentro del mes corriente.
- **Sin responder**: Conteo de `conversation` donde el último mensaje recibido fue `inbound` y no ha sido marcado como atendido.

### 2.2. `getSlaBreachedCount(orgId: string, minutes = 30)`
Calcula la cantidad de conversaciones donde:
- La conversación pertenece a `orgId`.
- El último mensaje registrado tiene dirección `inbound`.
- La fecha del último mensaje es anterior a `now() - minutes`.

### 2.3. `getUpcomingVisits(orgId: string, limit = 5)`
Consulta a `showing` con:
- `organizationId = orgId`
- `status = 'agendada'`
- `scheduledAt >= now()`
- Join con `client` para obtener `name`.
- Join con `property` para obtener `title` y `operationType`.
- Join con `user` (asesor) para obtener `name`.
- Orden `scheduledAt ASC` y límite de 5 registros.

### 2.4. `getRecentActivity(orgId: string, limit = 6)`
Genera el feed combinando las últimas actividades registradas:
- Nuevas visitas agendadas.
- Últimos mensajes entrantes de clientes.
- Tratos avanzados de etapa.

---

## 3. Integración en UI

- Actualizar `src/app/(dashboard)/inicio/page.tsx` para obtener los datos vía Server Components (`async/await`) en paralelo con `Promise.all`.
- Actualizar `src/components/dashboard/dashboard-view.tsx` para tipar sus props:
  ```typescript
  interface DashboardViewProps {
    firstName?: string;
    kpis: KpiItem[];
    slaCount: number;
    upcomingVisits: VisitRow[];
    recentActivity: ActivityItem[];
  }
  ```
- Eliminar la importación de `SAMPLE_*` en `dashboard-view.tsx`.
