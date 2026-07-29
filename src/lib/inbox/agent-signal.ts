import type { NeedsHumanReason } from "@/lib/inbox/types";

/**
 * Etiquetas es-MX de las señales del agente en la bandeja (feature 005). El motivo de
 * "requiere atención humana" se distingue por etiqueta (clarify: etiqueta por motivo).
 */

/** Etiqueta completa del motivo (cabecera del hilo). */
export function needsHumanLabel(reason: NeedsHumanReason | null | undefined): string {
  switch (reason) {
    case "out_of_window":
      return "Fuera de ventana 24 h";
    case "uninterpretable":
      return "Mensaje no interpretable";
    case "ai_error":
      return "La IA no pudo responder";
    case "requested":
      return "Pidió un asesor";
    default:
      return "Requiere atención humana";
  }
}

/** Etiqueta corta del motivo (badge de la lista). */
export function needsHumanShort(reason: NeedsHumanReason | null | undefined): string {
  switch (reason) {
    case "out_of_window":
      return "Fuera 24 h";
    case "uninterpretable":
      return "No interpretable";
    case "ai_error":
      return "Falló IA";
    case "requested":
      return "Asesor";
    default:
      return "Atención";
  }
}

/** Etiqueta de un mensaje entrante no textual (audio/imagen/…). `null` si es texto. */
export function nonTextLabel(waType: string | null | undefined): string | null {
  switch (waType) {
    case "audio":
      return "🎤 Nota de voz";
    case "image":
      return "🖼️ Imagen";
    case "video":
      return "🎬 Video";
    case "document":
      return "📄 Documento";
    case "location":
      return "📍 Ubicación";
    case "sticker":
      return "🌟 Sticker";
    case "contacts":
      return "👤 Contacto";
    default:
      return null;
  }
}
