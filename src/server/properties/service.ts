import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { property } from "@/lib/db/schema/domain";
import { listPhotoViews } from "@/server/properties/photos";
import type { PropertyDetail, PropertyPhotoView } from "@/lib/inbox/types";
import type { PropertyStatus } from "@/lib/design/status";
import type { PropertyCreateInput, PropertyUpdateInput } from "@/lib/properties/schemas";

/**
 * Servicio de administración de propiedades (feature 007). Todo scoped por
 * `organization_id` (Principio I/III). Los numéricos de Postgres viajan como string.
 */

type PropertyRow = typeof property.$inferSelect;

const numStr = (n: number | null | undefined): string | null => (n == null ? null : String(n));

function toDetail(row: PropertyRow, photos: PropertyPhotoView[]): PropertyDetail {
  return {
    id: row.id,
    operationType: row.operationType,
    propertyType: row.propertyType,
    title: row.title,
    price: row.price,
    currency: row.currency,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    builtAreaM2: row.builtAreaM2,
    lotAreaM2: row.lotAreaM2,
    parkingSpaces: row.parkingSpaces,
    status: row.status,
    description: row.description,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    photos,
  };
}

/** Detalle completo + galería de una propiedad del tenant, o null si no existe/otro tenant. */
export async function getPropertyDetail(
  organizationId: string,
  propertyId: string,
): Promise<PropertyDetail | null> {
  const [row] = await getDb()
    .select()
    .from(property)
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .limit(1);
  if (!row) return null;
  const photos = await listPhotoViews(organizationId, propertyId);
  return toDetail(row, photos);
}

/** Crea una propiedad del tenant y devuelve su detalle. */
export async function createProperty(
  organizationId: string,
  userId: string,
  input: PropertyCreateInput,
): Promise<PropertyDetail> {
  const id = newId("property");
  await getDb()
    .insert(property)
    .values({
      id,
      organizationId,
      createdBy: userId,
      operationType: input.operationType,
      propertyType: input.propertyType,
      title: input.title ?? null,
      price: String(input.price),
      currency: input.currency,
      address: input.address ?? null,
      neighborhood: input.neighborhood ?? null,
      city: input.city ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: numStr(input.bathrooms),
      builtAreaM2: numStr(input.builtAreaM2),
      lotAreaM2: numStr(input.lotAreaM2),
      parkingSpaces: input.parkingSpaces ?? null,
      description: input.description ?? null,
      status: input.status,
    });
  // Recién creada: no hay fotos todavía.
  return (await getPropertyDetail(organizationId, id))!;
}

/**
 * Edita parcialmente una propiedad del tenant: solo aplica las claves presentes en el
 * patch (undefined = no tocar; null = vaciar). Devuelve el detalle, o null si no existe.
 */
export async function updateProperty(
  organizationId: string,
  propertyId: string,
  input: PropertyUpdateInput,
): Promise<PropertyDetail | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.operationType !== undefined) set.operationType = input.operationType;
  if (input.propertyType !== undefined) set.propertyType = input.propertyType;
  if (input.title !== undefined) set.title = input.title;
  if (input.price !== undefined) set.price = String(input.price);
  if (input.currency !== undefined) set.currency = input.currency;
  if (input.address !== undefined) set.address = input.address;
  if (input.neighborhood !== undefined) set.neighborhood = input.neighborhood;
  if (input.city !== undefined) set.city = input.city;
  if (input.bedrooms !== undefined) set.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined) set.bathrooms = numStr(input.bathrooms);
  if (input.builtAreaM2 !== undefined) set.builtAreaM2 = numStr(input.builtAreaM2);
  if (input.lotAreaM2 !== undefined) set.lotAreaM2 = numStr(input.lotAreaM2);
  if (input.parkingSpaces !== undefined) set.parkingSpaces = input.parkingSpaces;
  if (input.description !== undefined) set.description = input.description;
  if (input.status !== undefined) set.status = input.status;

  const res = await getDb()
    .update(property)
    .set(set)
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .returning({ id: property.id });
  if (res.length === 0) return null;
  return getPropertyDetail(organizationId, propertyId);
}

/** Cambia el estatus (acción rápida US2). Devuelve false si no existe/otro tenant. */
export async function setStatus(
  organizationId: string,
  propertyId: string,
  status: PropertyStatus,
): Promise<boolean> {
  const res = await getDb()
    .update(property)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .returning({ id: property.id });
  return res.length > 0;
}

/**
 * Archiva (soft-delete) o desarchiva una propiedad del tenant. NO toca `status` (vuelve
 * "con su estatus previo"). Devuelve `{archivedAt}` o null si no existe/otro tenant.
 */
export async function setArchived(
  organizationId: string,
  propertyId: string,
  archived: boolean,
): Promise<{ archivedAt: Date | null } | null> {
  const archivedAt = archived ? new Date() : null;
  const res = await getDb()
    .update(property)
    .set({ archivedAt, updatedAt: new Date() })
    .where(and(eq(property.id, propertyId), eq(property.organizationId, organizationId)))
    .returning({ id: property.id });
  return res.length > 0 ? { archivedAt } : null;
}
