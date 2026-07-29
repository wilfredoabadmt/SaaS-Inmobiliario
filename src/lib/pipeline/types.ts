/**
 * Tipos compartidos del pipeline de ventas (feature 010). El tablero opera sobre la entidad
 * real `candidacy` ("trato" = cliente + propiedad opcional + etapa + agente), con etapas
 * configurables por organización (`pipeline_stage`).
 */

/** Rol semántico de una etapa: `normal` (editable/eliminable) o un ancla fija. */
export type StageKind = "normal" | "won" | "lost" | "visit";

/** Columna del Kanban (etapa configurable de la org). */
export interface StageView {
  id: string;
  label: string;
  sortOrder: number;
  kind: StageKind;
  color: string | null;
}

/** Tarjeta del tablero = un trato. `property`/`assignedAgent` pueden faltar. */
export interface DealCard {
  id: string;
  stageId: string;
  client: { id: string; name: string | null; channel: string };
  property: { id: string; title: string | null; operationType: "renta" | "venta" } | null;
  assignedAgent: { id: string; name: string } | null;
  updatedAt: string;
}

/** Respuesta del tablero: etapas ordenadas + tratos (el cliente agrupa por `stageId`). */
export interface BoardData {
  stages: StageView[];
  deals: DealCard[];
}

/** Etapa en el modo de configuración (US2): añade si es eliminable y cuántos tratos tiene. */
export interface StageConfig extends StageView {
  deletable: boolean;
  dealCount: number;
}

/** Requisitos de búsqueda del cliente para el panel (US4). */
export interface DealRequirements {
  operation: "renta" | "venta" | null;
  budgetLabel: string | null;
  zone: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
}

/** Mensaje resumido del hilo, para el panel (US4). */
export interface DealMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  createdAt: string;
}

/** Detalle de un trato para el panel lateral (US4). */
export interface DealDetail {
  id: string;
  stageId: string;
  client: { id: string; name: string | null; phone: string; channel: string };
  requirements: DealRequirements | null;
  property: {
    id: string;
    title: string | null;
    operationType: "renta" | "venta";
    photoUrl: string | null;
  } | null;
  conversationId: string;
  recentMessages: DealMessage[];
  assignedAgent: { id: string; name: string } | null;
}

/** Miembro de la organización candidato a asignación (US5). */
export interface OrgMember {
  id: string;
  name: string;
  role: "owner" | "agent";
}

const STAGE_KINDS: readonly StageKind[] = ["normal", "won", "lost", "visit"] as const;

/** Normaliza el `kind` (text en BD) al union tipado; desconocido → `normal`. */
export function asStageKind(value: string): StageKind {
  return (STAGE_KINDS as readonly string[]).includes(value) ? (value as StageKind) : "normal";
}
