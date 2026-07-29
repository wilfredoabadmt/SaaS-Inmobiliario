import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Placeholder de foto de propiedad (decisión D6): gradiente lineal 135° muteado
 * (pizarra/salvia/arena) elegido de forma estable por seed + ícono `home` al ~45%.
 * En producción se sustituye por la foto real. NO usa hex sueltos de la paleta de
 * marca: son gradientes de placeholder explícitos (excepción permitida en FR-006).
 */
const GRADIENTS = [
  "linear-gradient(135deg,#39414f,#66707e)",
  "linear-gradient(135deg,#3f5852,#6f928c)",
  "linear-gradient(135deg,#5f4d38,#a08a68)",
  "linear-gradient(135deg,#52504a,#9a958a)",
] as const;

function pick(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length]!;
}

export function PropertyThumb({
  seed,
  photoUrl,
  className,
  iconSize = 26,
}: {
  seed: string;
  /** Foto real (URL prefirmada de R2); si falta, se usa el gradiente placeholder. */
  photoUrl?: string | null;
  className?: string;
  iconSize?: number;
}) {
  if (photoUrl) {
    // URL prefirmada de R2 (host dinámico por env); next/image exigiría whitelistearlo.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={cn("object-cover", className)} />;
  }
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{ background: pick(seed) }}
      aria-hidden
    >
      <Home size={iconSize} strokeWidth={1.8} className="text-white/45" />
    </div>
  );
}
