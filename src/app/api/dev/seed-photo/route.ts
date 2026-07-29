import { and, eq } from "drizzle-orm";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { property, propertyPhoto } from "@/lib/db/schema/domain";
import { deleteObject, putObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * DEV — adjunta una foto a cada propiedad del tenant para probar la ficha-tarjeta con
 * imagen (feature 006). Usa **fotos generadas con IA** (Nano Banana Pro) específicas por
 * zona/tipo cuando el título coincide; si no, cae a un placeholder de bienes raíces por
 * keyword. Sube a R2 + crea `property_photo`, **reemplazando** cualquier foto previa.
 * Solo owner. Sustituible por el alta real de fotos de 001·US2.
 */

// Fotos IA por zona (Higgsfield / Nano Banana Pro). El `match` se busca en el título.
const AI_PHOTOS: Array<{ match: string; url: string }> = [
  { match: "polanco", url: "https://d8j0ntlcm91z4.cloudfront.net/user_3D8QIa39TWOp1eoX6Cbooj2Bndt/hf_20260621_052106_fe2fd70f-b4ec-4630-8649-140d338a0d6e.jpeg" },
  { match: "del valle", url: "https://d8j0ntlcm91z4.cloudfront.net/user_3D8QIa39TWOp1eoX6Cbooj2Bndt/hf_20260621_052108_6f62daeb-ff8f-4db6-a188-3faea12c3819.png" },
  { match: "condesa", url: "https://d8j0ntlcm91z4.cloudfront.net/user_3D8QIa39TWOp1eoX6Cbooj2Bndt/hf_20260621_052109_dfe41e66-0ce1-4f4d-b4ae-f253f10aa59e.png" },
  { match: "roma", url: "https://d8j0ntlcm91z4.cloudfront.net/user_3D8QIa39TWOp1eoX6Cbooj2Bndt/hf_20260621_052110_339bc478-c2b9-4c4a-ad8e-a7e77b75cd26.png" },
  { match: "valle oriente", url: "https://d8j0ntlcm91z4.cloudfront.net/user_3D8QIa39TWOp1eoX6Cbooj2Bndt/hf_20260621_052203_102a4b37-1996-4eb1-9a85-bd49be960b70.png" },
  { match: "puerta de hierro", url: "https://d8j0ntlcm91z4.cloudfront.net/user_3D8QIa39TWOp1eoX6Cbooj2Bndt/hf_20260621_052204_4e118b45-bfcb-4635-b1d4-a1fc2414c957.png" },
];

// Fallback de bienes raíces por keyword (si una propiedad no tiene foto IA asignada).
const FALLBACK_TAGS = ["apartment,interior", "house,architecture", "livingroom,interiordesign"];

function lockOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 1000;
}

export async function POST() {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const db = getDb();
  const props = await db
    .select({ id: property.id, title: property.title })
    .from(property)
    .where(eq(property.organizationId, organizationId));

  let seeded = 0;
  const errors: string[] = [];
  let idx = 0;
  for (const p of props) {
    const title = (p.title ?? "").toLowerCase();
    const ai = AI_PHOTOS.find((a) => title.includes(a.match));
    const url = ai?.url ?? `https://loremflickr.com/1024/768/${FALLBACK_TAGS[idx % FALLBACK_TAGS.length]}?lock=${lockOf(p.id)}`;
    idx += 1;

    // Reemplaza cualquier foto previa (R2 + DB).
    const existing = await db
      .select({ id: propertyPhoto.id, storageKey: propertyPhoto.storageKey })
      .from(propertyPhoto)
      .where(
        and(eq(propertyPhoto.organizationId, organizationId), eq(propertyPhoto.propertyId, p.id)),
      );
    for (const ph of existing) {
      try {
        await deleteObject(ph.storageKey);
      } catch {
        /* el objeto pudo no existir; no es fatal */
      }
    }
    if (existing.length) {
      await db
        .delete(propertyPhoto)
        .where(
          and(eq(propertyPhoto.organizationId, organizationId), eq(propertyPhoto.propertyId, p.id)),
        );
    }

    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) {
        errors.push(`${p.id}: fetch ${res.status}`);
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength < 1000) {
        errors.push(`${p.id}: imagen demasiado pequeña (${bytes.byteLength} bytes)`);
        continue;
      }
      const ct = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
      const contentType = ct.startsWith("image/") ? ct : "image/jpeg";
      const ext = contentType === "image/png" ? "png" : "jpg";
      const key = `properties/${p.id}/${newId("propertyPhoto")}.${ext}`;
      await putObject(key, bytes, contentType);
      await db.insert(propertyPhoto).values({
        id: newId("propertyPhoto"),
        organizationId,
        propertyId: p.id,
        storageKey: key,
        contentType,
        sizeBytes: bytes.byteLength,
        sortOrder: 0,
      });
      seeded += 1;
    } catch (e) {
      errors.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return Response.json({ seeded, errors });
}
