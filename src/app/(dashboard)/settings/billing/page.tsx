import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { requireOwner } from "@/lib/auth/guards";
import { PLANS } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/env";
import { BillingView } from "@/components/billing/billing-view";
import { getOrganizationSubscription, getOrganizationUsage } from "@/server/billing/service";
import { TYPO } from "@/lib/design/typography";

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  const ctx = await requireOwner();
  const [subscription, usage] = await Promise.all([
    getOrganizationSubscription(ctx.organizationId),
    getOrganizationUsage(ctx.organizationId),
  ]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[960px] px-8 py-8">
        <Link
          href="/settings"
          className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-[500] text-text-3 hover:text-text"
        >
          <ArrowLeft size={14} />
          <span>Volver a Configuración</span>
        </Link>

        <div className="mb-6 flex items-center gap-2.5">
          <CreditCard size={20} className="text-text-3" />
          <h1 className={TYPO.h1}>Facturación y Suscripción</h1>
        </div>

        <BillingView
          initialSubscription={subscription}
          initialUsage={usage}
          plans={Object.values(PLANS)}
          isStripeConfigured={isStripeConfigured()}
          isOwner={ctx.role === "owner"}
        />
      </div>
    </div>
  );
}
