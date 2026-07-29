import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Estado de validación inválida: aplica estilos de error y `aria-invalid`. */
  invalid?: boolean;
}

/** Input base con los tokens de diseño del proyecto (modo claro). */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-9 w-full rounded-sm border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-4",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid
          ? "border-red-400 focus-visible:ring-red-400"
          : "border-border focus-visible:ring-accent",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
