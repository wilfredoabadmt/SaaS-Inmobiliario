import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { client, conversation } from "@/lib/db/schema/domain";
import { asChannel, type ClientDetail } from "@/lib/clients/types";
import type { ClientCreateInput, ClientUpdateInput } from "@/lib/clients/schemas";

/**
 * Servicio de contactos (feature 009). Todo scoped por `organization_id` (Principio I/III).
 * La unicidad de teléfono es por organización (`client_org_phone_uq`): un choque devuelve
 * `phone_taken` (el endpoint lo mapea a 409), nunca crea/duplica.
 */

export type ClientWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "phone_taken" };

async function phoneTaken(
  organizationId: string,
  phone: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: client.id })
    .from(client)
    .where(
      exceptId
        ? and(
            eq(client.organizationId, organizationId),
            eq(client.phone, phone),
            ne(client.id, exceptId),
          )
        : and(eq(client.organizationId, organizationId), eq(client.phone, phone)),
    )
    .limit(1);
  return rows.length > 0;
}

/** Crea un contacto manual del tenant (canal de origen = "manual"). */
export async function createClient(
  organizationId: string,
  input: ClientCreateInput,
): Promise<ClientWriteResult> {
  if (await phoneTaken(organizationId, input.phone)) return { ok: false, reason: "phone_taken" };
  const id = newId("client");
  await getDb()
    .insert(client)
    .values({
      id,
      organizationId,
      name: input.name ?? null,
      phone: input.phone,
      email: input.email ?? null,
      notes: input.notes ?? null,
      channel: "manual",
    });
  return { ok: true, id };
}

/**
 * Edita parcialmente un contacto del tenant: solo aplica las claves presentes. El `channel`
 * no es editable (derivado del sistema). Cambiar el teléfono revalida unicidad por org.
 */
export async function updateClient(
  organizationId: string,
  clientId: string,
  input: ClientUpdateInput,
): Promise<ClientWriteResult> {
  const db = getDb();
  const [existing] = await db
    .select({ id: client.id, phone: client.phone })
    .from(client)
    .where(and(eq(client.id, clientId), eq(client.organizationId, organizationId)))
    .limit(1);
  if (!existing) return { ok: false, reason: "not_found" };

  if (input.phone !== undefined && input.phone !== existing.phone) {
    if (await phoneTaken(organizationId, input.phone, clientId)) {
      return { ok: false, reason: "phone_taken" };
    }
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) set.name = input.name;
  if (input.phone !== undefined) set.phone = input.phone;
  if (input.email !== undefined) set.email = input.email;
  if (input.notes !== undefined) set.notes = input.notes;

  await db
    .update(client)
    .set(set)
    .where(and(eq(client.id, clientId), eq(client.organizationId, organizationId)));
  return { ok: true, id: clientId };
}

/** Detalle de un contacto del tenant + su conversación más reciente, o null si no existe. */
export async function getClientDetail(
  organizationId: string,
  clientId: string,
): Promise<ClientDetail | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(client)
    .where(and(eq(client.id, clientId), eq(client.organizationId, organizationId)))
    .limit(1);
  if (!row) return null;

  const [conv] = await db
    .select({ id: conversation.id, lastMessageAt: conversation.lastMessageAt })
    .from(conversation)
    .where(and(eq(conversation.organizationId, organizationId), eq(conversation.clientId, clientId)))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(1);

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    channel: asChannel(row.channel),
    notes: row.notes,
    lastActivityAt: conv?.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
    conversationId: conv?.id ?? null,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Archiva (soft-delete reversible, feature 009) o desarchiva un contacto del tenant. NO
 * borra nada: conserva conversación, historial y contratos. Devuelve false si no
 * existe/otro tenant.
 */
export async function setArchived(
  organizationId: string,
  clientId: string,
  archived: boolean,
): Promise<boolean> {
  const res = await getDb()
    .update(client)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(client.id, clientId), eq(client.organizationId, organizationId)))
    .returning({ id: client.id });
  return res.length > 0;
}
