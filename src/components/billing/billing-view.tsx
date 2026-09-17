"use client";

import { useState } from "react";
import { Check, CreditCard, Sparkles, Building, Users, AlertCircle, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanConfig, SubscriptionPlan } from "@/lib/billing/plans";
import type { OrganizationSubscription, OrganizationUsage } from "@/server/billing/service";

interface BillingViewProps {
  initialSubscription: OrganizationSubscription;
  initialUsage: OrganizationUsage;
  plans: PlanConfig[];
  isStripeConfigured: boolean;
  isOwner: boolean;
}

export function BillingView({
  initialSubscription,
  initialUsage,
  plans,
  isStripeConfigured,
  isOwner,
}: BillingViewProps) {
  const [sub, setSub] = useState(initialSubscription);
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentPlanConfig = plans.find((p) => p.id === sub.plan) ?? plans[0];

  async function handleSelectPlan(targetPlan: SubscriptionPlan) {
    if (!isOwner || loadingPlan || targetPlan === sub.plan) return;
    setLoadingPlan(targetPlan);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      });

      const data = (await res.json().catch(() => null)) as {
        url?: string;
        success?: boolean;
        simulated?: boolean;
        plan?: SubscriptionPlan;
        error?: { message?: string };
      } | null;

      if (!res.ok || !data) {
        setErrorMsg(data?.error?.message ?? "Error al procesar la solicitud del plan.");
        setLoadingPlan(null);
        return;
      }

      if (data.url) {
        // Redirige a Stripe Checkout
        window.location.href = data.url;
        return;
      }

      if (data.success && data.plan) {
        setSub((prev) => ({
          ...prev,
          plan: data.plan!,
          status: "active",
        }));
        setSuccessMsg(
          data.simulated
            ? `Plan actualizado exitosamente a ${data.plan.toUpperCase()} (Modo desarrollo).`
            : `Plan actualizado exitosamente a ${data.plan.toUpperCase()}.`,
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado de red.");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handleOpenPortal() {
    if (!isOwner || loadingPortal) return;
    setLoadingPortal(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: { message?: string } } | null;
      if (res.ok && data?.url) {
        window.location.href = data.url;
      } else {
        setErrorMsg(data?.error?.message ?? "No se pudo acceder al portal de facturación.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado de red.");
    } finally {
      setLoadingPortal(false);
    }
  }

  // Porcentaje de uso de propiedades
  const maxProps = currentPlanConfig.limits.maxProperties;
  const propPercent = maxProps === Number.POSITIVE_INFINITY
    ? 10
    : Math.min(100, Math.round((initialUsage.propertiesCount / maxProps) * 100));

  // Porcentaje de uso de miembros
  const maxMembers = currentPlanConfig.limits.maxMembers;
  const memberPercent = maxMembers === Number.POSITIVE_INFINITY
    ? 15
    : Math.min(100, Math.round((initialUsage.membersCount / maxMembers) * 100));

  return (
    <div className="space-y-8">
      {/* Mensajes de retroalimentación */}
      {errorMsg && (
        <div className="flex items-center gap-2.5 rounded-lg border border-danger-border bg-danger-bg p-4 text-[13px] text-danger-text">
          <AlertCircle size={17} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-lg border border-success-border bg-success-bg p-4 text-[13px] text-success-text">
          <ShieldCheck size={17} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Resumen del Plan Actual y Consumo */}
      <div className="rounded-xl border border-border bg-bg-panel p-6 shadow-rest">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] font-[600] uppercase tracking-wider text-text-3">Plan Actual</span>
              <span className="inline-flex items-center rounded-full bg-accent-tint px-2.5 py-0.5 text-[11px] font-[600] text-accent-text">
                {currentPlanConfig.name}
              </span>
              {sub.status === "active" ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-[500] text-emerald-600 dark:text-emerald-400">
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-[500] text-amber-600 dark:text-amber-400">
                  {sub.status}
                </span>
              )}
            </div>
            <h2 className="mt-1 text-[20px] font-[700] text-text">
              {currentPlanConfig.monthlyPriceMxn === 0
                ? "Gratuito"
                : `$${currentPlanConfig.monthlyPriceMxn.toLocaleString("es-MX")} MXN / mes`}
            </h2>
            <p className="mt-1 text-[13px] text-text-3">{currentPlanConfig.description}</p>
          </div>

          {isStripeConfigured && sub.stripeCustomerId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenPortal}
              disabled={loadingPortal}
              className="flex items-center gap-2"
            >
              <CreditCard size={14} />
              <span>{loadingPortal ? "Abriendo..." : "Gestionar Facturación"}</span>
              <ExternalLink size={12} className="text-text-3" />
            </Button>
          )}
        </div>

        {/* Barras de Consumo de Cuotas */}
        <div className="mt-6 grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
          {/* Propiedades */}
          <div className="rounded-lg border border-border bg-bg-app/50 p-4">
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 font-[600] text-text">
                <Building size={16} className="text-accent-text" />
                <span>Propiedades Activas</span>
              </div>
              <span className="font-mono text-[12px] font-[600] text-text-2">
                {initialUsage.propertiesCount} / {maxProps === Number.POSITIVE_INFINITY ? "∞" : maxProps}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full transition-all ${
                  propPercent > 90 ? "bg-danger" : propPercent > 70 ? "bg-amber-500" : "bg-accent"
                }`}
                style={{ width: `${propPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-text-3">
              {maxProps === Number.POSITIVE_INFINITY
                ? "Inventario sin límite de propiedades."
                : `${Math.max(0, maxProps - initialUsage.propertiesCount)} espacios restantes para publicar.`}
            </p>
          </div>

          {/* Asesores */}
          <div className="rounded-lg border border-border bg-bg-app/50 p-4">
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 font-[600] text-text">
                <Users size={16} className="text-accent-text" />
                <span>Asesores en Equipo</span>
              </div>
              <span className="font-mono text-[12px] font-[600] text-text-2">
                {initialUsage.membersCount} / {maxMembers === Number.POSITIVE_INFINITY ? "∞" : maxMembers}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full transition-all ${
                  memberPercent > 90 ? "bg-danger" : memberPercent > 70 ? "bg-amber-500" : "bg-accent"
                }`}
                style={{ width: `${memberPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-text-3">
              {maxMembers === Number.POSITIVE_INFINITY
                ? "Asientos de equipo ilimitados."
                : `${Math.max(0, maxMembers - initialUsage.membersCount)} invitaciones restantes permitidas.`}
            </p>
          </div>
        </div>
      </div>

      {/* Selector de Planes */}
      <div>
        <div className="mb-4">
          <h3 className="text-[16px] font-[700] text-text">Planes Disponibles</h3>
          <p className="text-[13px] text-text-3">
            Elige el plan que mejor se adapte al tamaño y crecimiento de tu agencia inmobiliaria.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.id === sub.plan;
            const isLoading = loadingPlan === p.id;

            return (
              <div
                key={p.id}
                className={`relative flex flex-col justify-between rounded-xl border p-5 transition-all ${
                  isCurrent
                    ? "border-accent bg-accent-tint/10 shadow-lift"
                    : "border-border bg-bg-panel hover:border-border-strong hover:shadow-rest"
                }`}
              >
                {p.badge && (
                  <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10.5px] font-[600] text-white shadow-sm">
                    <Sparkles size={11} />
                    {p.badge}
                  </span>
                )}

                <div>
                  <h4 className="text-[16px] font-[700] text-text">{p.name}</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-[24px] font-[800] text-text">
                      {p.monthlyPriceMxn === 0 ? "Gratis" : `$${p.monthlyPriceMxn.toLocaleString("es-MX")}`}
                    </span>
                    {p.monthlyPriceMxn > 0 && <span className="text-[12px] text-text-3">MXN / mes</span>}
                  </div>
                  <p className="mt-2 text-[12px] text-text-3">{p.description}</p>

                  <ul className="mt-5 space-y-2.5 border-t border-border pt-4">
                    {p.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12.5px] text-text-2">
                        <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4">
                  {isCurrent ? (
                    <Button disabled variant="outline" className="w-full">
                      Plan Actual
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant={p.id === "pro" ? "default" : "secondary"}
                      className="w-full"
                      disabled={loadingPlan !== null || !isOwner}
                      onClick={() => handleSelectPlan(p.id)}
                    >
                      {isLoading
                        ? "Procesando..."
                        : p.id === "starter"
                          ? "Elegir Starter"
                          : `Actualizar a ${p.name}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
