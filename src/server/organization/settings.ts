import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organization } from "@/lib/db/schema/auth";
import type { ImageContentType } from "@/lib/images";
import {
  isKeyUnderPrefix,
  resolveImageUrl,
  signImageUpload,
  type SignedImageUpload,
} from "@/server/storage/images";

/**
 * Servicio de los datos de la Organización (feature 013, US3). Solo el owner muta (el
 * endpoint aplica `requireOwner`). El logo se sube en 2 fases a R2 y se persiste como
 * storage key en `organization.logo`.
 */

function logoPrefix(orgId: string): string {
  return `org-logos/${orgId}/`;
}

export interface OrganizationView {
  id: string;
  name: string;
  /** URL prefirmada del logo, o null. */
  logoUrl: string | null;
}

export async function getOrganization(orgId: string): Promise<OrganizationView | null> {
  const [row] = await getDb()
    .select({ id: organization.id, name: organization.name, logo: organization.logo })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  if (!row) return null;
  return { id: row.id, name: row.name, logoUrl: await resolveImageUrl(row.logo) };
}

export async function updateOrganizationName(orgId: string, name: string): Promise<void> {
  await getDb().update(organization).set({ name }).where(eq(organization.id, orgId));
}

export function signLogo(orgId: string, contentType: ImageContentType): Promise<SignedImageUpload> {
  return signImageUpload(logoPrefix(orgId), contentType);
}

/** Valida prefijo del tenant y persiste `organization.logo`. Null si la key es inválida. */
export async function confirmLogo(
  orgId: string,
  input: { storageKey: string },
): Promise<{ logoUrl: string | null } | null> {
  if (!isKeyUnderPrefix(input.storageKey, logoPrefix(orgId))) return null;
  await getDb()
    .update(organization)
    .set({ logo: input.storageKey })
    .where(eq(organization.id, orgId));
  return { logoUrl: await resolveImageUrl(input.storageKey) };
}
