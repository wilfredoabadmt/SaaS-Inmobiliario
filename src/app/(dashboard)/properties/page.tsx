import { requireMember } from "@/lib/auth/guards";
import { PropertiesClient } from "@/components/properties/properties-client";
import { listProperties } from "@/server/properties/queries";

export const dynamic = "force-dynamic";

/** Inventario real de propiedades del tenant (feature 007). Default: solo activas. */
export default async function PropertiesPage() {
  const { organizationId } = await requireMember();
  const properties = await listProperties(organizationId);
  return <PropertiesClient properties={properties} />;
}
