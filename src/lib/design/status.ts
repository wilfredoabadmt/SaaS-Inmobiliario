/**
 * Estatus de propiedad / visita y etapas de pipeline — feature 003-design-system.
 * Los colores viven como var(--token) en globals.css; aquí solo se mapea cada
 * estado a sus clases Tailwind (arbitrary value sobre el token).
 */

// ---------- Estatus de propiedad ----------
export type PropertyStatus = "disponible" | "apartada" | "cerrada";

export const PROPERTY_STATUS_LABEL: Record<PropertyStatus, string> = {
  disponible: "Disponible",
  apartada: "Apartada",
  cerrada: "Cerrada",
};

const PROP_PREFIX: Record<PropertyStatus, string> = {
  disponible: "disp",
  apartada: "apar",
  cerrada: "cerr",
};

/** Clases (texto + bg) del chip de estatus de propiedad. */
export function propertyStatusChipClasses(s: PropertyStatus): string {
  const p = PROP_PREFIX[s];
  return `text-[color:var(--prop-${p}-text)] bg-[color:var(--prop-${p}-bg)]`;
}

export function propertyStatusDotClass(s: PropertyStatus): string {
  return `bg-[color:var(--prop-${PROP_PREFIX[s]}-dot)]`;
}

// ---------- Estatus de visita ----------
export type VisitStatus = "agendada" | "realizada" | "cancelada" | "no_show";

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  no_show: "No-show",
};

const VISIT_PREFIX: Record<VisitStatus, string> = {
  agendada: "agen",
  realizada: "real",
  cancelada: "canc",
  no_show: "nosh",
};

export function visitStatusChipClasses(s: VisitStatus): string {
  const p = VISIT_PREFIX[s];
  return `text-[color:var(--visit-${p}-text)] bg-[color:var(--visit-${p}-bg)]`;
}

export function visitStatusDotClass(s: VisitStatus): string {
  return `bg-[color:var(--visit-${VISIT_PREFIX[s]}-dot)]`;
}

// ---------- Etapas de pipeline ----------
export type PipelineStage =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "visita_agendada"
  | "documentacion"
  | "en_negociacion"
  | "ganado";

/** Orden de columnas del Kanban (el handoff no muestra "perdido" como columna). */
export const PIPELINE_STAGES: readonly PipelineStage[] = [
  "nuevo",
  "contactado",
  "calificado",
  "visita_agendada",
  "documentacion",
  "en_negociacion",
  "ganado",
] as const;

export const STAGE_LABEL: Record<PipelineStage, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  visita_agendada: "Visita agendada",
  documentacion: "Documentación",
  en_negociacion: "En negociación",
  ganado: "Ganado",
};

const STAGE_VAR: Record<PipelineStage, string> = {
  nuevo: "--stage-nuevo",
  contactado: "--stage-contactado",
  calificado: "--stage-calificado",
  visita_agendada: "--stage-visita",
  documentacion: "--stage-documentacion",
  en_negociacion: "--stage-negociacion",
  ganado: "--stage-ganado",
};

/** Punto de color de la etapa (para cabecera de columna y chip de etapa). */
export function stageDotClass(s: PipelineStage): string {
  return `bg-[color:var(${STAGE_VAR[s]})]`;
}
