import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { member, invitation } from "@/lib/db/schema/auth";
import { property, subscription } from "@/lib/db/schema/domain";
import {
  getPlanConfig,
  type PlanConfig,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "@/lib/billing/plans";

export interface OrganizationSubscription {
  id?: string;
  organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface OrganizationUsage {
  propertiesCount: number;
  membersCount: number;
}

export interface PlanLimitCheckResult {
  allowed: boolean;
  resource: "properties" | "members";
  current: number;
  limit: number;
  plan: SubscriptionPlan;
  planConfig: PlanConfig;
}

export class PlanLimitError extends Error {
  constructor(
    public readonly resource: "properties" | "members",
    public readonly limit: number,
    public readonly current: number,
    public readonly plan: SubscriptionPlan,
  ) {
    super(`Límite del plan ${plan.toUpperCase()} alcanzado para ${resource}: ${current}/${limit}`);
    this.name = "PlanLimitError";
  }
}

/**
 * Obtiene la suscripción activa de la organización. Si no existe registro,
 * retorna por defecto el plan Starter activo.
 */
export async function getOrganizationSubscription(
  organizationId: string,
): Promise<OrganizationSubscription> {
  const db = getDb();
  const rows = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, organizationId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      organizationId,
      plan: "starter",
      status: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    plan: (row.plan as SubscriptionPlan) ?? "starter",
    status: (row.status as SubscriptionStatus) ?? "active",
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}

/**
 * Crea o actualiza la suscripción de una organización de forma idempotente.
 */
export async function upsertSubscription(
  organizationId: string,
  data: {
    plan?: SubscriptionPlan;
    status?: SubscriptionStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  },
): Promise<OrganizationSubscription> {
  const db = getDb();
  const existing = await db
    .select({ id: subscription.id })
    .from(subscription)
    .where(eq(subscription.organizationId, organizationId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(subscription)
      .set({
        ...(data.plan !== undefined ? { plan: data.plan } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.stripeCustomerId !== undefined ? { stripeCustomerId: data.stripeCustomerId } : {}),
        ...(data.stripeSubscriptionId !== undefined
          ? { stripeSubscriptionId: data.stripeSubscriptionId }
          : {}),
        ...(data.currentPeriodEnd !== undefined ? { currentPeriodEnd: data.currentPeriodEnd } : {}),
        ...(data.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: data.cancelAtPeriodEnd } : {}),
        updatedAt: new Date(),
      })
      .where(eq(subscription.organizationId, organizationId));
  } else {
    await db.insert(subscription).values({
      id: newId("subscription"),
      organizationId,
      plan: data.plan ?? "starter",
      status: data.status ?? "active",
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return getOrganizationSubscription(organizationId);
}

/**
 * Consulta el consumo de recursos de la organización (propiedades y asientos de asesores).
 */
export async function getOrganizationUsage(organizationId: string): Promise<OrganizationUsage> {
  const db = getDb();

  const [propResult, memberResult, invResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(property)
      .where(and(eq(property.organizationId, organizationId), isNull(property.archivedAt))),
    db
      .select({ count: count() })
      .from(member)
      .where(eq(member.organizationId, organizationId)),
    db
      .select({ count: count() })
      .from(invitation)
      .where(and(eq(invitation.organizationId, organizationId), eq(invitation.status, "pending"))),
  ]);

  const propertiesCount = Number(propResult[0]?.count ?? 0);
  const membersCount = Number(memberResult[0]?.count ?? 0) + Number(invResult[0]?.count ?? 0);

  return {
    propertiesCount,
    membersCount,
  };
}

/**
 * Verifica si la organización tiene cupo disponible para crear un nuevo recurso.
 */
export async function checkPlanLimits(
  organizationId: string,
  resource: "properties" | "members",
): Promise<PlanLimitCheckResult> {
  const [sub, usage] = await Promise.all([
    getOrganizationSubscription(organizationId),
    getOrganizationUsage(organizationId),
  ]);

  const planConfig = getPlanConfig(sub.plan);
  const current = resource === "properties" ? usage.propertiesCount : usage.membersCount;
  const limit =
    resource === "properties" ? planConfig.limits.maxProperties : planConfig.limits.maxMembers;

  const allowed = current < limit;

  return {
    allowed,
    resource,
    current,
    limit,
    plan: sub.plan,
    planConfig,
  };
}

/**
 * Lanza PlanLimitError si el recurso excede la cuota del plan contratado.
 */
export async function assertPlanLimits(
  organizationId: string,
  resource: "properties" | "members",
): Promise<void> {
  const check = await checkPlanLimits(organizationId, resource);
  if (!check.allowed) {
    throw new PlanLimitError(resource, check.limit, check.current, check.plan);
  }
}
