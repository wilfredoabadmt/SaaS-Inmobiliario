/**
 * Tipos compartidos del módulo de contactos (feature 009). El "contacto" es la entidad
 * de dominio `client`. El canal de origen es extensible (DV-CM-1).
 */

/** Canales de origen posibles. Hoy solo `whatsapp` opera; el resto es preparación. */
export const CHANNELS = ["whatsapp", "instagram", "messenger", "manual"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Degradación defensiva: un valor desconocido en BD se trata como `manual`. */
export function asChannel(value: string | null | undefined): Channel {
  return (CHANNELS as readonly string[]).includes(value ?? "") ? (value as Channel) : "manual";
}

/** Fila de la lista de contactos (vista de tenant). */
export interface ClientListItem {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  channel: Channel;
  /** Última actividad = `lastMessageAt` de la conversación más reciente; null si no tiene. */
  lastActivityAt: string | null;
  /** Conversación más reciente si existe (para el deep-link directo a la bandeja). */
  conversationId: string | null;
  /** Archivado (soft-delete): null = activo; ISO = archivado. */
  archivedAt: string | null;
}

/** Detalle de un contacto (incluye campos editables completos). */
export interface ClientDetail extends ClientListItem {
  notes: string | null;
  createdAt: string;
}
