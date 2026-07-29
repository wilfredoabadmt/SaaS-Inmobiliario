import { ClientsClient } from "@/components/clients/clients-client";
import type { Channel, ClientListItem } from "@/lib/clients/types";
import { SAMPLE_CLIENTS } from "@/lib/design/sample-data";

// Preview de diseño (003): mapea los fixtures a ClientListItem y rota canales para
// mostrar las variantes del badge. NINGUNA feature de producción depende de esto.
const PREVIEW_CHANNELS: Channel[] = ["whatsapp", "manual", "instagram", "messenger"];

const previewClients: ClientListItem[] = SAMPLE_CLIENTS.map((c, i) => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  email: null,
  channel: PREVIEW_CHANNELS[i % PREVIEW_CHANNELS.length]!,
  lastActivityAt: null,
  conversationId: null,
  archivedAt: null,
}));

export default function ClientsPreviewPage() {
  return <ClientsClient clients={previewClients} />;
}
