# Quickstart — Verificar el agente de IA + matching (004)

**Feature**: `004-ai-agent-matching` · **Date**: 2026-06-19

Puerta mínima (Principio V): **typecheck + lint + build**. Cierre del sprint (SC-008): **self-test
de comportamiento** — conversar como cliente por WhatsApp y corroborar matching + calidad de
respuesta. Esto último es el paso añadido a la metodología.

## 0. Configuración

`.env` (ya presente `OPENROUTER_API_TOKEN`). Opcionales (con defaults):
```
OPENROUTER_AGENT_MODEL=deepseek/deepseek-v4-flash
OPENROUTER_MATCH_MODEL=deepseek/deepseek-v4-pro
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```
Migración aditiva aplicada (tabla `client_requirements` + columnas). En prod se aplica por el
Pre-Deployment Command (drizzle migrate).

## 1. Puerta de calidad automática

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

## 2. Matching (US1) — verificación rápida

- Captura requisitos de un cliente (PUT requirements o por el agente) y confirma que el panel
  "Matching en vivo" lista propiedades **reales** del tenant rankeadas, con % coherente, razones
  cumple/no-cumple y explicación.
- Cambia un requisito (p. ej. zona) → el ranking cambia; sube `version`.
- Caso "sin requisitos" y "sin coincidencias" se comunican (no hay ranking inventado).

## 3. Self-test de comportamiento (SC-008) — el cierre del sprint

Me hago pasar por cliente vía Evolution (número personal `[TU_NUMERO_TESTER]`) → número de prueba de la
plataforma (`[NUMERO_PRUEBA_PLATAFORMA]`), con el agente **activado** en la conversación. Guion
`scripts/wa-tester/agent-roundtrip.mjs`:

1. **Seed**: siembra propiedades de prueba (fixtures) como inventario del tenant.
2. **Activa** el agente en la conversación (endpoint `/agent` o toggle).
3. **Conversa como cliente** (mensajes desde el personal):
   - "Hola, busco departamento en **renta** en **Polanco**, **2 recámaras**, hasta **28 mil**."
   - (espera respuesta del agente) … "¿Tienes algo con estacionamiento?"
   - "Me interesa, ¿lo puedo ver el jueves?"
   - "Mejor quiero hablar con un asesor." → debe hacer **handoff**.
4. **Verifica** (con IA + asserts):
   - **Calificación**: `client_requirements` quedó con operación=renta, zona=Polanco, tipo=depto,
     recámaras=2, presupuesto≈28k (SC-002 ≥90% de campos).
   - **Match efectivo**: la propiedad propuesta/ficha enviada es la de **mayor afinidad real** según
     esos requisitos (SC-001 ≥90%).
   - **Tono**: respuestas en es-MX, amables, sin inventar inventario/precio (SC-003/SC-004).
   - **Ficha correcta**: la ficha enviada corresponde al mejor match (US3).
   - **Handoff**: al pedir asesor, el agente deja de responder y la conversación queda
     `needs_human` (SC-006).
   - **Idempotencia**: reenviar el mismo evento no duplica respuesta (SC-005).
   - **Agente off**: con el toggle apagado, 0 respuestas automáticas (SC-007).

## 4. Checklist de cierre

- [ ] typecheck + lint + build en verde.
- [ ] Panel de matching con datos reales (US1).
- [ ] Toggle del agente (opt-in) y badge de "requiere atención humana" (handoff) funcionando.
- [ ] Self-test: calificación correcta, match efectivo, ficha correcta, tono amable, handoff,
      idempotencia, agente-off — todos corroborados con evidencia (transcripción/capturas).
- [ ] Sin alucinaciones de inventario; sin generación de contratos.

> Nota: las pruebas de envío usan el guardrail de Evolution (allowlist personal + número de prueba) y
> respetan el anti-ráfaga para no arriesgar la línea personal.
