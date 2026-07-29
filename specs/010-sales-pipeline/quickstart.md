# Quickstart & Self-test E2E: 010-sales-pipeline

Cómo verificar la feature. El gate técnico es el piso; el **cierre** es el self-test de **comportamiento**
que conduzco yo (Definición de Hecho REFORZADA, constitución V + CLAUDE.md).

## Gate técnico (piso)

```bash
pnpm typecheck && pnpm lint && pnpm build
```
Más la **migración** aplicada en `inmox-dev` con verificación de conteos (no se pierde ninguna etapa de
trato vivo):
```sql
-- ANTES (esquema viejo): distribución por etapa
SELECT stage, count(*) FROM candidacy GROUP BY stage ORDER BY 1;
-- DESPUÉS (esquema nuevo): debe coincidir 1:1 con los labels sembrados
SELECT ps.label, count(*) FROM candidacy c JOIN pipeline_stage ps ON ps.id = c.stage_id
GROUP BY ps.label ORDER BY 1;
```

## Self-test E2E de comportamiento (cierre real)

Esta feature es **mayormente UI/datos** (no cambia el cerebro del agente ni el envío saliente), así que el
self-test es **conductual de UI** sobre `inmox-dev`, con datos reales de la org de prueba. No requiere el
flujo de WhatsApp-agente salvo el punto del deep-link.

### Camino feliz

1. **Tablero real (US1)**: abrir `/pipeline`. Ver tratos reales de la org (no `SAMPLE_LEADS`), agrupados por
   etapa, con cliente / propiedad (o "sin propiedad") / operación / agente.
2. **Auto-alta por inbound (DV-SP-6)**: desde el número de prueba (Evolution, allowlist) enviar un primer
   mensaje a la plataforma → el contacto aparece **solo** como tarjeta en la etapa inicial ("Nuevo"), sin
   propiedad, sin crearla a mano. Reenviar otro inbound del mismo contacto **no** duplica la tarjeta.
3. **Crear trato manual (DV-SP-6b)**: alta manual desde el pipeline eligiendo un cliente real (009); con y
   sin propiedad. Aparece en la primera etapa.
4. **Mover + persistir (US1/US3)**: arrastrar una tarjeta a otra etapa (drag-and-drop) → recargar → sigue
   ahí. Repetir con los **chevrons** (fallback). Verificar conteos por columna.
5. **Scroll cómodo (US3)**: con varias tarjetas, la columna hace scroll vertical con la rueda; el tablero
   scroll horizontal entre etapas.
6. **Abrir panel (US4)**: clic (sin arrastrar) en una tarjeta → drawer con nombre/teléfono/badge de canal,
   requisitos, propiedad + foto, y resumen de últimos mensajes. **"Abrir en bandeja"** → cae en
   `/inbox?c=<conversationId>` **de ese mismo cliente** (verificar que NO abre otra conversación).
7. **Configurar etapas como owner (US2)**: entrar a "Configurar etapas" (como owner): renombrar una etapa
   intermedia, agregar una, reordenar → el tablero refleja el cambio (propio y, tras refresco, en otra
   sesión de la agencia). Verificar que "Ganado/Perdido/Visita agendada" aparecen como no eliminables.
8. **Asignar agente (US5)**: asignar un trato a un agente real de la org → la tarjeta muestra su inicial →
   persiste. Reasignar a otro. Poner "Sin asignar".
9. **Ancla de visita + avance (DV-SP-1/DV-SP-8)**: agendar una visita (flujo existente de showings) para un
   cliente↔propiedad → el trato **avanza** a la etapa ancla `visit` ("Visita agendada"), aun si el owner la
   renombró; si el trato ya estaba más adelante (p. ej. "En negociación"), **no retrocede**. Si el cliente
   solo tenía el trato sin-propiedad del auto-alta, se **promueve** (se le asocia la propiedad) sin duplicar.

### Camino infeliz (provocar y comprobar que degrada sin colgarse)

- **Aislamiento de tenant**: con dos organizaciones, confirmar que A no ve ni puede mover/abrir/asignar
  tratos de B; `GET/PATCH /api/pipeline/deals/<id-de-B>` → `404`.
- **Reasignar a no-miembro**: `PATCH …/deals/[id]` con un `assignedAgentId` que no es `member` de la org →
  `400 not_a_member`, sin cambio.
- **Borrar etapa con tratos**: `DELETE …/stages/[id]` de una etapa con tarjetas sin `reassignToStageId` →
  `409 stage_not_empty`; con `reassignToStageId` válido → mueve los tratos y borra.
- **Borrar ancla**: `DELETE …/stages/[id]` sobre Ganado/Perdido/Visita → `400 anchor_stage`.
- **Mover a etapa inexistente**: `PATCH …/deals/[id]` con un `stageId` que otro miembro borró →
  `400 invalid_stage`; el tablero refresca al estado real.
- **Soltar fuera de columna**: arrastrar y soltar fuera de cualquier columna válida → la tarjeta vuelve a su
  sitio, sin cambio persistido.
- **Trato sin propiedad**: abrir su panel → "sin propiedad" y enlace a ficha deshabilitado, sin error.
- **Inbound repetido**: reenviar inbounds del mismo contacto NO crea tarjetas extra (auto-alta idempotente).
- **Visita no retrocede**: agendar una visita a un trato que ya está en "En negociación" NO lo regresa a
  "Visita agendada" (regla de avance, FR-029/FR-030).
- **Config como agente (no owner)**: un agente no encuentra/no puede usar "Configurar etapas";
  `POST/PATCH/DELETE …/stages` → `403`.

### Pendiente de verificación humana (no verificable por mí)

- Estética y fluidez del arrastre (sensación "cómoda"), pulido visual del drawer y de las columnas.

## Notas de despliegue

- **Migración + código en el mismo deploy**: `showings/service.ts` (ancla `visit`) y el esquema nuevo deben
  ir juntos; el código viejo contra el esquema nuevo rompería al insertar candidacy.
- Probar la migración primero en `inmox-dev` (datos reales) y comparar conteos antes/después.
- `seedDefaultStages(orgId)` idempotente para orgs creadas después de la migración (primer acceso al tablero
  o primer trato).
