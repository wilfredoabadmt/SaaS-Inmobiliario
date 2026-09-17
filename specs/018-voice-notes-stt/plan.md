# Plan Técnico: Transcripción de Notas de Voz de WhatsApp (018-voice-notes-stt)

## 1. Constitution Check

- **Principio I (Seguridad de datos)**: Los audios de los clientes y los tokens de acceso a Meta Graph API nunca se exponen al navegador.
- **Principio II (Integración Externa Aislada)**: La descarga de medios se ubica en `src/lib/meta/` y la transcripción en `src/server/ai/stt.ts`.
- **Principio V (Calidad Verificable)**: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- **Principio VIII (Foco Inmobiliario)**: Permite capturar requisitos de prospectos inmobiliarios transmitidos por voz.

---

## 2. Descarga de Medios Meta Cloud API (`src/lib/meta/index.ts`)

Meta Cloud API maneja los audios mediante dos pasos:
1. `GET /v21.0/{media_id}` $\rightarrow$ devuelve `{ url: string, mime_type: string, file_size: number }`.
2. `GET {url}` con encabezado `Authorization: Bearer <token>` $\rightarrow$ descarga el binario `audio/ogg; codecs=opus`.

---

## 3. Transcripción con IA (`src/server/ai/stt.ts`)

- Utiliza la API multimodal de OpenRouter (`google/gemini-2.5-flash` o similar) pasando el audio codificado en Base64 dentro del array de contenidos:
  ```typescript
  {
    role: "user",
    content: [
      { type: "text", text: "Transcribe el audio al español..." },
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
    ]
  }
  ```
- Si la llamada es exitosa, retorna el texto limpio. Si falla, retorna `null`.

---

## 4. Pipeline de Ingesta (`src/server/inbox/ingest.ts`)

- Al recibir un mensaje con `msg.type === "audio"`:
  - Se ejecuta en background (`after`):
    1. Descarga el audio binario con las credenciales del tenant.
    2. Transcribe a texto con `transcribeAudio`.
    3. Si hay texto: actualiza `message.body = "[Nota de voz]: " + text`.
    4. Si `conv.aiEnabled && !conv.needsHuman`: llama a `scheduleAgentRun(organizationId, conv.id)`.
    5. Si no hay texto: ejecuta `handleNonTextInbound` (degradación previa).
