# Plan Técnico: Movimiento Agéntico del Pipeline por IA (017-ai-pipeline-progression)

## 1. Constitution Check

- **Principio IV (Idempotencia)**: La regla `advanceStageForward` es idempotente por diseño: si la tarjeta ya se encuentra en la etapa destino o en una posterior, la consulta es un no-op.
- **Principio V (Calidad Verificable)**: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- **Principio VIII (Foco Inmobiliario)**: Transiciones basadas en el embudo comercial inmobiliario: Nuevo $\rightarrow$ Contactado $\rightarrow$ Calificado $\rightarrow$ Visita $\rightarrow$ Documentación $\rightarrow$ Negociación.

---

## 2. Helpers en `src/server/pipeline/stages.ts`

- `resolveStageByKindOrLabel(organizationId: string, query: string): Promise<string | null>`:
  Busca etapas de la agencia donde `kind = query` o `lower(label) LIKE lower(%query%)`.
- `advanceClientDeal(organizationId: string, clientId: string, targetQuery: string): Promise<void>`:
  Localiza la candidatura del cliente en la organización y llama a `advanceStageForward(organizationId, candidacyId, targetStageId)`.

---

## 3. Integración en Flujos de Mensajería y Agente IA

1. **Mensaje Saliente (Humano o Plantilla)**:
   - En `src/server/inbox/send.ts`, tras insertar el mensaje saliente, llamar a `advanceClientDeal(organizationId, clientId, "contactado")`.
2. **Turno del Agente de IA**:
   - En `src/server/ai/agent.ts`:
     - Al enviar respuesta saliente de IA: avanzar a `"contactado"`.
     - Si `parsed.requirements` contiene datos válidos (presupuesto, zona, operación, recámaras): avanzar a `"calificado"`.
     - Si `action.type === "advance_stage"`: extraer `action.stage` o `action.targetStage` y llamar a `advanceClientDeal(organizationId, clientId, targetStage)`.
