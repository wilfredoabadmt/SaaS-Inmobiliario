import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { candidacy, client, property, showing } from "@/lib/db/schema/domain";
import type { VisitRow } from "@/lib/design/sample-data";

/** Visita activa (futura, agendada) de un cliente — para el contexto del agente (US2). */
export interface ActiveShowing {
  showingId: string;
  propertyTitle: string;
  startUtc: string;
}

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** Lista de visitas del tenant (próximas y recientes) para la vista de Visitas. */
export async function listShowings(organizationId: string): Promise<VisitRow[]> {
  const rows = await getDb()
    .select({
      id: showing.id,
      scheduledAt: showing.scheduledAt,
      status: showing.status,
      propTitle: property.title,
      propOperation: property.operationType,
      clientName: client.name,
      agentName: user.name,
    })
    .from(showing)
    .innerJoin(property, eq(showing.propertyId, property.id))
    .leftJoin(candidacy, eq(showing.candidacyId, candidacy.id))
    .leftJoin(client, eq(candidacy.clientId, client.id))
    .leftJoin(user, eq(showing.agentId, user.id))
    .where(eq(showing.organizationId, organizationId))
    .orderBy(desc(showing.scheduledAt))
    .limit(50);

  return rows.map((r) => {
    const d = r.scheduledAt;
    return {
      id: r.id,
      client: r.clientName ?? "Cliente de WhatsApp",
      operation: r.propOperation,
      property: r.propTitle ?? "Propiedad",
      dateLabel: d.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" }),
      month: MONTHS[d.getMonth()] ?? "",
      day: String(d.getDate()).padStart(2, "0"),
      time: d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      agent: r.agentName ?? "Sin asignar",
      status: r.status,
    };
  });
}

/**
 * Visitas activas (agendadas, futuras) de un cliente. El agente las inyecta en su contexto para
 * poder reprogramar/cancelar por `showingId` (US2). `startUtc` se etiqueta luego en la tz del asesor.
 */
export async function listActiveShowingsForClient(
  organizationId: string,
  clientId: string,
): Promise<ActiveShowing[]> {
  const rows = await getDb()
    .select({
      showingId: showing.id,
      scheduledAt: showing.scheduledAt,
      propTitle: property.title,
    })
    .from(showing)
    .innerJoin(property, eq(showing.propertyId, property.id))
    .innerJoin(candidacy, eq(showing.candidacyId, candidacy.id))
    .where(
      and(
        eq(showing.organizationId, organizationId),
        eq(candidacy.clientId, clientId),
        eq(showing.status, "agendada"),
        gt(showing.scheduledAt, new Date()),
      ),
    )
    .orderBy(showing.scheduledAt)
    .limit(10);

  return rows.map((r) => ({
    showingId: r.showingId,
    propertyTitle: r.propTitle ?? "Propiedad",
    startUtc: r.scheduledAt.toISOString(),
  }));
}
