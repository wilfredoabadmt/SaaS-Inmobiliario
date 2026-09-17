import { getEnv } from "@/lib/env";

/**
 * Transcribe un archivo de audio (nota de voz de WhatsApp) a texto en español utilizando
 * modelos de lenguaje multimodales a través de OpenRouter (Feature 018).
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/ogg",
): Promise<string | null> {
  const env = getEnv();
  if (!env.OPENROUTER_API_TOKEN) {
    console.error("[stt] Falta OPENROUTER_API_TOKEN");
    return null;
  }

  const base64Audio = audioBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Audio}`;

  // Modelo multimodal capaz de procesar audio (Gemini 2.5 Flash o Gemini Flash)
  const model = env.OPENROUTER_AGENT_MODEL.includes("gemini")
    ? env.OPENROUTER_AGENT_MODEL
    : "google/gemini-2.5-flash";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_TOKEN}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.APP_BASE_URL,
        "X-Title": "Homya",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Eres un transcriptor de audio profesional en español. Tu tarea es escuchar el audio proporcionado y transcribir con exactitud todo lo que se dice. Responde ÚNICAMENTE con el texto transcrito, sin preámbulos, sin comillas, sin explicaciones ni notas adicionales. Si el audio es ininteligible o solo contiene silencio, responde exactamente: (audio inaudible)",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe exactamente el contenido de este audio:",
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 600,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[stt] OpenRouter error ${res.status}:`, errText);
      return null;
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();

    if (!text || text === "(audio inaudible)") {
      return null;
    }

    return text;
  } catch (err) {
    console.error("[stt] Error al transcribir audio:", err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
