# Tasks: Transcripción de Notas de Voz de WhatsApp (018-voice-notes-stt)

## Phase 1 — Descarga de Medios Meta y Servicio STT
- [x] T001 Implementar `fetchMediaUrl` y `downloadMediaBinary` en `src/lib/meta/index.ts`
- [x] T002 Implementar servicio de transcripción `transcribeAudio` en `src/server/ai/stt.ts`

## Phase 2 — Integración en Webhook de Ingesta
- [x] T003 Conectar el procesamiento de mensajes de audio en `src/server/inbox/ingest.ts` (descarga, transcripción, actualización de `message.body` y disparo del Agente IA)
- [x] T004 Manejo de degradación segura en caso de fallo de audio

## Phase 3 — Verificación
- [x] T005 Pasar el gate técnico de calidad: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
