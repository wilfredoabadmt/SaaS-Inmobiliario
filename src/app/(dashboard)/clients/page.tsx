import { ClientsClient } from "@/components/clients/clients-client";
import { requireMember } from "@/lib/auth/guards";
import { listClients } from "@/server/clients/queries";

export const dynamic = "force-dynamic";

/**
 * Directorio de contactos (feature 009). Datos reales con scope de tenant (sustituye los
 * SAMPLE_CLIENTS de 003).
 */
export default async function ClientsPage() {
  const { organizationId } = await requireMember();
  const clients = await listClients(organizationId);
  return <ClientsClient clients={clients} />;
}
