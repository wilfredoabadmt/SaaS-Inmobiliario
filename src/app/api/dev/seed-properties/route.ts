import { eq } from "drizzle-orm";
import { authErrorResponse, requireOwner } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { property } from "@/lib/db/schema/domain";

export const dynamic = "force-dynamic";

/** Inventario de prueba para validar el agente + matching (feature 004, self-test). */
const SEED = [
  { operationType: "renta", propertyType: "departamento", title: "Depto en Polanco, 2 rec", price: "28000", neighborhood: "Polanco", city: "CDMX", bedrooms: 2, bathrooms: "2", builtAreaM2: "95" },
  { operationType: "renta", propertyType: "departamento", title: "Depto en Del Valle", price: "22000", neighborhood: "Del Valle", city: "CDMX", bedrooms: 2, bathrooms: "2", builtAreaM2: "82" },
  { operationType: "renta", propertyType: "departamento", title: "Depto en Condesa", price: "24000", neighborhood: "Condesa", city: "CDMX", bedrooms: 2, bathrooms: "1.5", builtAreaM2: "76" },
  { operationType: "renta", propertyType: "departamento", title: "Loft en Roma Norte", price: "19500", neighborhood: "Roma Norte", city: "CDMX", bedrooms: 1, bathrooms: "1", builtAreaM2: "58" },
  { operationType: "venta", propertyType: "casa", title: "Casa en Valle Oriente", price: "8900000", neighborhood: "Valle Oriente", city: "Monterrey", bedrooms: 4, bathrooms: "4.5", builtAreaM2: "320" },
  { operationType: "venta", propertyType: "departamento", title: "PH en Puerta de Hierro", price: "12500000", neighborhood: "Puerta de Hierro", city: "Guadalajara", bedrooms: 3, bathrooms: "3.5", builtAreaM2: "240" },
] as const;

/** POST — siembra inventario de prueba para el tenant del owner (idempotente: no duplica). */
export async function POST() {
  let organizationId: string;
  let userId: string;
  try {
    ({ organizationId, userId } = await requireOwner());
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const db = getDb();
  const existing = await db
    .select({ id: property.id })
    .from(property)
    .where(eq(property.organizationId, organizationId));
  if (existing.length >= SEED.length) {
    return Response.json({ seeded: 0, total: existing.length, message: "El tenant ya tiene inventario." });
  }

  await db.insert(property).values(
    SEED.map((s) => ({
      id: newId("property"),
      organizationId,
      operationType: s.operationType,
      propertyType: s.propertyType,
      title: s.title,
      price: s.price,
      currency: "MXN",
      neighborhood: s.neighborhood,
      city: s.city,
      bedrooms: s.bedrooms,
      bathrooms: s.bathrooms,
      builtAreaM2: s.builtAreaM2,
      status: "disponible" as const,
      createdBy: userId,
    })),
  );

  return Response.json({ seeded: SEED.length, message: "Inventario de prueba creado." });
}
