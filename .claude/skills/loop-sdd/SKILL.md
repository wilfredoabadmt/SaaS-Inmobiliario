---
name: loop-sdd
description: >
  Ejecuta un OBJETIVO de punta a punta en modo loop autónomo adaptado al Spec-Driven
  Development de este proyecto (Inmox). Úsalo cuando el dueño dé una META o resultado
  esperado en lugar de instrucciones paso a paso ("logra que…", "quiero que el agente…",
  "implementa la feature X y déjala funcionando"), o diga explícitamente /loop-sdd. El
  agente recorre Discover → Plan → Execute → Verify → Iterate, se autocorrige con sus
  herramientas, y vuelve al dueño SOLO cuando el objetivo está verificado en vivo o hay un
  bloqueo real. No para a pedir permiso por cada paso reversible ni delega la prueba.
---

# Loop SDD — ejecutar objetivos, no prompts

El dueño da **objetivos**; tú corres el **loop completo** y vuelves **solo al terminar o al
bloquearte de verdad**. Es la implementación de `Goal→Work→Check→Repeat` (no `Ask→Answer→Stop`)
sobre el flujo Spec Kit de este repo. El contrato canónico vive en `CLAUDE.md` → **"Modo
Objetivo — Loop SDD"** y **"Definición de Hecho REFORZADA"**; este skill es el punto de entrada.

## Entrada
El argumento es el **objetivo** (qué debe lograrse / cómo debe comportarse el SaaS). Si no se
pasó argumento, toma el último objetivo que el dueño describió en la conversación.

## El loop (no saltes Verify)

1. **Discover** — Lee el estado real antes de actuar: spec/plan/tasks de la feature activa,
   código relevante, memoria (`MEMORY.md` + archivos), y logs si hay un bug. Decide si el
   objetivo necesita una spec nueva (`speckit-specify` + `speckit-clarify`) o si es una
   corrección/extensión sobre una feature existente.
   - **Agrupa TODAS las preguntas bloqueantes y hazlas UNA sola vez aquí.** Si puedes resolver
     algo con defaults sensatos o leyendo el código, hazlo; no preguntes.

2. **Plan** — `speckit-plan` → `speckit-tasks` → `speckit-analyze`. Para correcciones pequeñas,
   un plan ligero basta, pero deja el alcance explícito.

3. **Execute** — `speckit-implement` (o la edición directa para fixes acotados). Respeta el
   stack y la constitución del proyecto (TS estricto, multi-tenant, idempotencia, secretos).

4. **Verify (OBLIGATORIO — lo hace el agente, no el dueño)** —
   - Gate técnico: `pnpm typecheck` + `pnpm lint` + `pnpm build`.
   - **Self-test de comportamiento E2E**: despliega a inmox-dev y **ejerce el flujo real** como
     usuario. Para agente/WhatsApp/bandeja/matching/ficha usa el skill
     `whatsapp-ai-agent-selftest` (línea de prueba Evolution `…462…9768` → número de la
     plataforma) y conduce la **conversación multi-turno completa** (calificar → matchear →
     `send_sheet`/ficha → tocar botones → handoff).
   - **Camino infeliz**: provoca lo que el LLM/Meta exponen (no-JSON, respuesta vacía, fuera de
     ventana 24 h, no-texto) y comprueba que **degrada sin colgarse**.
   - Confirma el **resultado observable** con evidencia (transcripción/captura/log), no solo un
     2xx del endpoint ni "compila".

5. **Iterate** — Si algo falla, diagnostica (logs de Coolify, el `raw=` del LLM), corrige y
   **re-verifica tú**. Cada fix vuelve al loop, no a la bandeja del dueño. Sin *spin*: si un
   deploy tarda (~8-15 min), avanza en otra cosa o espera con criterio.

## Sostén del loop
- **State**: `tasks.md` es tu estado durable — mantenlo al día; te permite reanudar si se corta
  el contexto.
- **Memory**: persiste decisiones, gotchas y correcciones (no repitas errores ya aprendidos).
- **Cost**: agrupa verificaciones, no quemes créditos ni dispares deploys de más.

## Condición de paro — cuándo (y solo cuándo) volver al dueño
- ✅ **Objetivo cumplido**: criterios de aceptación verdes **en vivo**, verificados por ti, con
  evidencia. Reporta qué se logró y la evidencia.
- ⛔ **Bloqueo real** (única razón para interrumpir a mitad): decisión de producto ambigua que
  cambia el resultado · falta de credenciales/acceso · **acción irreversible o hacia afuera** que
  exige OK del dueño (merge a `main`, borrado destructivo, comunicación externa, gastar
  dinero/créditos) · techo de costo/tiempo acordado. Trae contexto + opciones + tu recomendación.

## Nunca
- Declarar "listo" sin haber ejercido el comportamiento tú mismo.
- Delegar la prueba funcional al dueño ("despliego para que TÚ pruebes").
- Pedir permiso por cada paso reversible (rompe el loop).
