import { InboxClient } from "@/components/inbox/inbox-client";
import { requireMember } from "@/lib/auth/guards";
import { listConversations, listTemplates } from "@/server/inbox/queries";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { organizationId } = await requireMember();
  const [{ c }, conversations, templates] = await Promise.all([
    searchParams,
    listConversations(organizationId),
    listTemplates(organizationId),
  ]);

  // Deep-link "Enviar mensaje" desde Contactos (feature 009): preselecciona la conversación.
  return (
    <InboxClient
      conversations={conversations}
      templates={templates}
      initialConversationId={c ?? null}
    />
  );
}
