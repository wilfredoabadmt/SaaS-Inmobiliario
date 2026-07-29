/**
 * Escala tipográfica del handoff (003-design-system). Constantes de clases Tailwind
 * reutilizables para mantener pesos y tracking consistentes en todas las vistas.
 * Geist variable (ya cargada en layout.tsx).
 */
export const TYPO = {
  /** Título de pantalla (h1): 24 / 600 / -.025em */
  h1: "text-[24px] font-[600] tracking-[-0.025em] text-text",
  /** Título de sección "Bandeja": 19 / 600 / -.02em */
  section: "text-[19px] font-[600] tracking-[-0.02em] text-text",
  /** Número KPI: 30 / 600 / -.03em */
  kpi: "text-[30px] font-[600] tracking-[-0.03em] text-text",
  /** % de match: 18 / 600 / -.03em */
  matchPct: "text-[18px] font-[600] tracking-[-0.03em]",
  /** Nombre (header de chat): 15 / 600 */
  name: "text-[15px] font-[600] text-text",
  /** Título de tarjeta: 13.5 / 600 */
  cardTitle: "text-[13.5px] font-[600] text-text",
  /** Cuerpo: 13 / 450 */
  body: "text-[13px] font-[450] text-text-2",
  /** Precio: 16 / 700 */
  price: "text-[16px] font-[700] text-text",
  /** Micro-label en mayúsculas: 11 / 700 / tracking .055em / faintest */
  microLabel:
    "text-[11px] font-[700] uppercase tracking-[0.055em] text-ink-faintest",
} as const;
