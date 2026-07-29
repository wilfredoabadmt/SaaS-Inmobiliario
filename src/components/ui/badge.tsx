import { cn } from "@/lib/utils";
import {
  operationChipClasses,
  operationDotClass,
  operationLabel,
  type Operation,
} from "@/lib/design/operation";
import {
  PROPERTY_STATUS_LABEL,
  VISIT_STATUS_LABEL,
  STAGE_LABEL,
  propertyStatusChipClasses,
  propertyStatusDotClass,
  visitStatusChipClasses,
  visitStatusDotClass,
  stageDotClass,
  type PropertyStatus,
  type VisitStatus,
  type PipelineStage,
} from "@/lib/design/status";

/**
 * Chip/píldora del sistema de diseño (003). SIEMPRE muestra texto + color, nunca
 * solo color (FR-029). Usa los helpers de operación/estatus para no repetir hex.
 */

const PILL =
  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-[650] uppercase tracking-wide";

function Dot({ className }: { className: string }) {
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", className)} />;
}

export function OperationBadge({
  operation,
  className,
}: {
  operation: Operation;
  className?: string;
}) {
  return (
    <span className={cn(PILL, operationChipClasses(operation), className)}>
      <Dot className={operationDotClass(operation)} />
      {operationLabel(operation)}
    </span>
  );
}

export function PropertyStatusBadge({
  status,
  className,
}: {
  status: PropertyStatus;
  className?: string;
}) {
  return (
    <span className={cn(PILL, propertyStatusChipClasses(status), className)}>
      <Dot className={propertyStatusDotClass(status)} />
      {PROPERTY_STATUS_LABEL[status]}
    </span>
  );
}

export function VisitStatusBadge({
  status,
  className,
}: {
  status: VisitStatus;
  className?: string;
}) {
  return (
    <span className={cn(PILL, visitStatusChipClasses(status), className)}>
      <Dot className={visitStatusDotClass(status)} />
      {VISIT_STATUS_LABEL[status]}
    </span>
  );
}

export function StageBadge({
  stage,
  className,
}: {
  stage: PipelineStage;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-bg px-2 py-0.5 text-[11px] font-[550] text-text-3",
        className,
      )}
    >
      <Dot className={stageDotClass(stage)} />
      {STAGE_LABEL[stage]}
    </span>
  );
}

/** Chip neutro reutilizable (requisitos del cliente, metadatos). */
export function NeutralChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] font-[500] text-text-3",
        className,
      )}
    >
      {children}
    </span>
  );
}
