/**
 * Helpers de operación (venta / renta) — feature 003-design-system.
 * Venta = teal/salvia, renta = bronce. Centraliza la etiqueta y las clases por
 * operación para que ningún componente repita la condición ni hex sueltos.
 */
import type { OperationType } from "@/lib/inbox/types";

export type Operation = OperationType; // "renta" | "venta"

export function operationLabel(op: Operation): string {
  return op === "venta" ? "Venta" : "Renta";
}

/** Clases del chip (bg + texto + borde) por operación. */
export function operationChipClasses(op: Operation): string {
  return op === "venta"
    ? "bg-venta-tint text-venta-text border border-venta-border"
    : "bg-renta-tint text-renta-text border border-renta-border";
}

/** Color de texto/acento por operación (p. ej. % de match, barra). */
export function operationTextClass(op: Operation): string {
  return op === "venta" ? "text-venta" : "text-renta";
}

/** Color de fondo sólido por operación (avatar, barra de match). */
export function operationBgClass(op: Operation): string {
  return op === "venta" ? "bg-venta" : "bg-renta";
}

/** Avatar: relleno por operación con tinta blanca (handoff: avatar bg = color op). */
export function operationAvatarClasses(op: Operation): string {
  return op === "venta" ? "bg-venta text-white" : "bg-renta text-white";
}

/** Punto de color por operación (dot). */
export function operationDotClass(op: Operation): string {
  return op === "venta" ? "bg-venta-dot" : "bg-renta-dot";
}
