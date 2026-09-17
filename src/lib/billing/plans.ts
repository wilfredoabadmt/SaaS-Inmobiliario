/**
 * Definición de planes, cuotas y características de suscripción (Feature 019).
 */

export type SubscriptionPlan = "starter" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export interface PlanLimits {
  maxProperties: number;
  maxMembers: number;
  voiceNotesTranscription: boolean;
  automatedVisitReminders: boolean;
  priorityAi: boolean;
}

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  badge?: string;
  description: string;
  monthlyPriceMxn: number;
  stripePriceId?: string;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<SubscriptionPlan, PlanConfig> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Ideal para agentes independientes o agencias que inician.",
    monthlyPriceMxn: 0,
    limits: {
      maxProperties: 10,
      maxMembers: 2,
      voiceNotesTranscription: false,
      automatedVisitReminders: false,
      priorityAi: false,
    },
    features: [
      "Hasta 10 propiedades en inventario",
      "Hasta 2 asesores (Owner + 1)",
      "CRM y Pipeline de ventas completo",
      "Agente IA WhatsApp estándar",
      "Gestión de documentos de candidatos",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    badge: "Más Popular",
    description: "Para inmobiliarias en crecimiento con equipo y volumen de leads.",
    monthlyPriceMxn: 1299,
    limits: {
      maxProperties: 50,
      maxMembers: 5,
      voiceNotesTranscription: true,
      automatedVisitReminders: true,
      priorityAi: false,
    },
    features: [
      "Hasta 50 propiedades en inventario",
      "Hasta 5 asesores de equipo",
      "Transcripción de notas de voz WhatsApp con IA (STT)",
      "Recordatorios automáticos de visitas a clientes por WhatsApp",
      "Analítica avanzada y seguimiento de contratos",
      "Soporte prioritario por WhatsApp",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Para grandes firmas y desarrolladoras con alto volumen de operaciones.",
    monthlyPriceMxn: 3499,
    limits: {
      maxProperties: Number.POSITIVE_INFINITY,
      maxMembers: Number.POSITIVE_INFINITY,
      voiceNotesTranscription: true,
      automatedVisitReminders: true,
      priorityAi: true,
    },
    features: [
      "Propiedades ilimitadas",
      "Asesores de equipo ilimitados",
      "Modelos de IA dedicados y máxima prioridad",
      "Todas las características de Pro incluidas",
      "Integraciones a medida y SLA garantizado",
      "Gerente de cuenta dedicado",
    ],
  },
};

export function getPlanConfig(plan?: string | null): PlanConfig {
  if (plan === "pro") return PLANS.pro;
  if (plan === "enterprise") return PLANS.enterprise;
  return PLANS.starter;
}
