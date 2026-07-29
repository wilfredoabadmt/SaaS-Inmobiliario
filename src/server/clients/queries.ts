import { and, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { client, conversation } from "@/lib/db/schema/domain";
import { asChannel, type ClientListItem } from "@/lib/clients/types";

/** Filtro de archivado para la lista de contactos. */
export type ClientArchivedFilter = "active" | "archived" | "all";

export interface ListClientsOptions {
  q?: string;
  archived?: ClientArchivedFilter;
}

/**
 * Lista de contactos del tenant (feature 009, FR-001). Adjunta canal de origen, última
 * actividad y conversación más reciente (deep-link). Por defecto **excluye archivados**
 * (soft-delete); `archived: "archived"` los muestra para restaurarlos. Scoped por org.
 */
export async function listClients(
  organizationId: string,
  opts: ListClientsOptions = {},
): Promise<ClientListItem[]> {
  const db = getDb();
  const term = opts.q?.trim();
  const archived = opts.archived ?? "active";

  const where = and(
    eq(client.organizationId, organizationId),
    archived === "active"
      ? isNull(client.archivedAt)
      : archived === "archived"
        ? isNotNull(client.archivedAt)
        : undefined,
    term ? or(ilike(client.name, `%${term}%`), ilike(client.phone, `%${term}%`)) : undefined,
  );

  const clients = await db
    .select({
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      channel: client.channel,
      archivedAt: client.archivedAt,
    })
    .from(client)
    .where(where)
    .orderBy(desc(client.createdAt))
    .limit(500);

  if (clients.length === 0) return [];

  // Conversación más reciente por cliente (no asumimos orden SQL con NULLs: comparamos en JS).
  const convs = await db
    .select({
      clientId: conversation.clientId,
      id: conversation.id,
      lastMessageAt: conversation.lastMessageAt,
    })
    .from(conversation)
    .where(eq(conversation.organizationId, organizationId));

  const latest = new Map<string, { id: string; lastMessageAt: Date | null }>();
  for (const c of convs) {
    const prev = latest.get(c.clientId);
    const cur = c.lastMessageAt?.getTime() ?? 0;
    const prevT = prev?.lastMessageAt?.getTime() ?? -1;
    if (!prev || cur > prevT) latest.set(c.clientId, { id: c.id, lastMessageAt: c.lastMessageAt });
  }

  const items: ClientListItem[] = clients.map((c) => {
    const conv = latest.get(c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      channel: asChannel(c.channel),
      lastActivityAt: conv?.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
      conversationId: conv?.id ?? null,
      archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
    };
  });

  // Con actividad reciente primero (desc); los sin actividad quedan al final por creación.
  items.sort((a, b) => {
    if (a.lastActivityAt && b.lastActivityAt) return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
    if (a.lastActivityAt) return -1;
    if (b.lastActivityAt) return 1;
    return 0;
  });

  return items;
}
