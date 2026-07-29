/** DTOs compartidos entre las API de bandeja y la UI. */

import type { PipelineStage, PropertyStatus } from "@/lib/design/status";

export type OperationType = "renta" | "venta";

/** Motivo por el que una conversación requiere atención humana (feature 005). */
export type NeedsHumanReason =
  | "requested"
  | "out_of_window"
  | "uninterpretable"
  | "ai_error";

/** Vista de una propiedad del inventario (presentación). */
export interface PropertyView {
  id: string;
  title: string;
  operation: OperationType;
  zone: string;
  type: string;
  priceLabel: string;
  specs: string;
  status: PropertyStatus;
  /** Semilla estable para el gradiente placeholder de foto. */
  photoSeed: string;
  /** URL (prefirmada) de la foto principal real; si falta, se usa el placeholder. */
  photoUrl?: string | null;
}

/** Una foto de la galería de una propiedad (detalle, feature 007). */
export interface PropertyPhotoView {
  id: string;
  /** URL prefirmada de descarga. */
  url: string;
  sortOrder: number;
  /** Principal = menor sortOrder. */
  isMain: boolean;
}

/**
 * Detalle completo de una propiedad (feature 007): todos los campos crudos + galería.
 * Los numéricos llegan como string (numeric de Postgres) tal cual los devuelve Drizzle.
 */
export interface PropertyDetail {
  id: string;
  operationType: OperationType;
  propertyType: string;
  title: string | null;
  price: string;
  currency: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  builtAreaM2: string | null;
  lotAreaM2: string | null;
  parkingSpaces: number | null;
  status: PropertyStatus;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  photos: PropertyPhotoView[];
}

/** Un cliente que hace match con una propiedad (match inverso, feature 007). */
export interface MatchingClient {
  clientId: string;
  name: string | null;
  phone: string;
  /** Afinidad 0–100. */
  pct: number;
  reasons: MatchReason[];
}

/** Requisitos de búsqueda del cliente (alimentan el matching). Parciales mientras se califica. */
export interface ClientRequirements {
  operation?: OperationType | null;
  budgetLabel?: string;
  zone?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
}

export interface MatchReason {
  ok: boolean;
  label: string;
}

/** Una propiedad rankeada por afinidad para un cliente. */
export interface Match {
  property: PropertyView;
  /** Afinidad 0–100. */
  pct: number;
  reasons: MatchReason[];
  why: string;
}

export interface ConversationListItem {
  id: string;
  clientName: string | null;
  clientPhone: string;
  lastMessageAt: string | null;
  primaryProperty: {
    id: string;
    title: string | null;
    operationType: OperationType;
  } | null;
  // --- campos de diseño (003): opcionales para no romper la query existente ---
  /** Mensajes sin leer (badge). */
  unread?: number;
  /** Vista previa del último mensaje (1 línea). */
  lastMessagePreview?: string | null;
  clientEmail?: string | null;
  assignee?: string | null;
  stage?: PipelineStage;
  notes?: string;
  requirements?: ClientRequirements;
  matches?: Match[];
  // Agente de IA (feature 004).
  aiEnabled?: boolean;
  needsHuman?: boolean;
  // Robustez (feature 005): por qué requiere atención humana (null/undefined si no).
  needsHumanReason?: NeedsHumanReason | null;
}

export interface MessageItem {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  status: string | null;
  createdAt: string;
  /** Tipo de burbuja: texto (default) o ficha de propiedad enviada por matching. */
  kind?: "text" | "property";
  /** Payload de la ficha cuando kind === "property". */
  property?: PropertyView;
  /** Mensaje saliente generado por el agente de IA (feature 004). */
  aiGenerated?: boolean;
  /** Tipo del mensaje entrante de WhatsApp (feature 005): text/audio/image/… */
  waType?: string | null;
}

export interface TemplateItem {
  id: string;
  name: string;
  category: string | null;
  body: string;
  /** Nº de variables posicionales {{n}} del cuerpo (feature 012); 0 si no tiene. */
  variables: number;
}
