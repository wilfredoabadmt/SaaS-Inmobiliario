import { and, desc, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import {
  candidacy,
  client,
  conversation,
  message,
  pipelineStage,
  property,
  showing,
} from "@/lib/db/schema/domain";
import type { ActivityItem, KpiData, UpcomingVisit } from "@/server/dashboard/types";

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function timeAgo(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return "hace unos segundos";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

/**
 * Retorna las tarjetas de KPIs calculadas en tiempo real para el tenant.
 */
export async function getDashboardKpis(organizationId: string): Promise<KpiData[]> {
  const db = getDb();
  const now = new Date();

  // Rangos de tiempo
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Inicio y fin de la semana actual
  const dayOfWeek = (now.getDay() + 6) % 7; // Lunes = 0, Domingo = 6
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Inicio del mes actual
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

  try {
    const [
      leadsRecentRes,
      leadsPrevRes,
      activeConvsRes,
      weekVisitsRes,
      monthDealsRes,
      recentConvs,
    ] = await Promise.all([
      // 1. Leads nuevos en últimos 7 días
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(client)
        .where(and(eq(client.organizationId, organizationId), gte(client.createdAt, sevenDaysAgo))),

      // Leads de los 7 días previos (para calcular delta)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(client)
        .where(
          and(
            eq(client.organizationId, organizationId),
            gte(client.createdAt, fourteenDaysAgo),
            lt(client.createdAt, sevenDaysAgo),
          ),
        ),

      // 2. Conversaciones activas en los últimos 7 días
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversation)
        .where(
          and(
            eq(conversation.organizationId, organizationId),
            gte(conversation.lastMessageAt, sevenDaysAgo),
          ),
        ),

      // 3. Visitas de esta semana
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(showing)
        .where(
          and(
            eq(showing.organizationId, organizationId),
            ne(showing.status, "cancelada"),
            gte(showing.scheduledAt, startOfWeek),
            lte(showing.scheduledAt, endOfWeek),
          ),
        ),

      // 4. Cierres ganados del mes
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(candidacy)
        .innerJoin(pipelineStage, eq(candidacy.stageId, pipelineStage.id))
        .where(
          and(
            eq(candidacy.organizationId, organizationId),
            eq(pipelineStage.kind, "won"),
            gte(candidacy.updatedAt, startOfMonth),
          ),
        ),

      // 5. Conversaciones recientes para calcular sin responder de forma tipada
      db
        .select({ id: conversation.id })
        .from(conversation)
        .where(eq(conversation.organizationId, organizationId))
        .orderBy(desc(conversation.lastMessageAt))
        .limit(50),
    ]);

    let unrepliedCount = 0;
    if (recentConvs.length > 0) {
      const convIds = recentConvs.map((c) => c.id);
      const msgs = await db
        .select({
          conversationId: message.conversationId,
          direction: message.direction,
        })
        .from(message)
        .where(
          and(
            eq(message.organizationId, organizationId),
            inArray(message.conversationId, convIds),
          ),
        )
        .orderBy(desc(message.createdAt));

      const seen = new Set<string>();
      for (const m of msgs) {
        if (!seen.has(m.conversationId)) {
          seen.add(m.conversationId);
          if (m.direction === "inbound") {
            unrepliedCount++;
          }
        }
      }
    }

    const newLeads = leadsRecentRes[0]?.count ?? 0;
    const prevLeads = leadsPrevRes[0]?.count ?? 0;
    const deltaLeads = newLeads - prevLeads;
    const deltaStr =
      deltaLeads > 0
        ? `▲ +${deltaLeads} vs sem. ant.`
        : deltaLeads < 0
          ? `▼ ${deltaLeads} vs sem. ant.`
          : undefined;

    const activeConvs = activeConvsRes[0]?.count ?? 0;
    const weekVisits = weekVisitsRes[0]?.count ?? 0;
    const monthDeals = monthDealsRes[0]?.count ?? 0;

    return [
      {
        label: "Leads nuevos",
        value: String(newLeads),
        delta: deltaStr,
      },
      {
        label: "Conversaciones activas",
        value: String(activeConvs),
      },
      {
        label: "Visitas esta semana",
        value: String(weekVisits),
      },
      {
        label: "Cierres del mes",
        value: String(monthDeals),
      },
      {
        label: "Sin responder",
        value: String(unrepliedCount),
        tone: unrepliedCount > 0 ? "warn" : "default",
      },
    ];
  } catch (err) {
    console.error("[dashboard] Error en getDashboardKpis:", err);
    return [
      { label: "Leads nuevos", value: "0" },
      { label: "Conversaciones activas", value: "0" },
      { label: "Visitas esta semana", value: "0" },
      { label: "Cierres del mes", value: "0" },
      { label: "Sin responder", value: "0" },
    ];
  }
}

/**
 * Conteo de conversaciones que tienen mensajes inbound sin responder hace más de `thresholdMinutes`.
 */
export async function getSlaBreachedCount(
  organizationId: string,
  thresholdMinutes = 30,
): Promise<number> {
  try {
    const db = getDb();
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const nowMs = Date.now();

    const convs = await db
      .select({ id: conversation.id })
      .from(conversation)
      .where(eq(conversation.organizationId, organizationId))
      .orderBy(desc(conversation.lastMessageAt))
      .limit(50);

    if (convs.length === 0) return 0;

    const convIds = convs.map((c) => c.id);
    const msgs = await db
      .select({
        conversationId: message.conversationId,
        direction: message.direction,
        createdAt: message.createdAt,
      })
      .from(message)
      .where(
        and(
          eq(message.organizationId, organizationId),
          inArray(message.conversationId, convIds),
        ),
      )
      .orderBy(desc(message.createdAt));

    let breachedCount = 0;
    const seen = new Set<string>();
    for (const m of msgs) {
      if (!seen.has(m.conversationId)) {
        seen.add(m.conversationId);
        const createdDate = m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt);
        if (m.direction === "inbound" && nowMs - createdDate.getTime() >= thresholdMs) {
          breachedCount++;
        }
      }
    }

    return breachedCount;
  } catch (err) {
    console.error("[dashboard] Error en getSlaBreachedCount:", err);
    return 0;
  }
}

/**
 * Retorna las próximas citas (muestras) agendadas y futuras del tenant.
 */
export async function getUpcomingVisits(
  organizationId: string,
  limit = 5,
): Promise<UpcomingVisit[]> {
  try {
    const rows = await getDb()
      .select({
        id: showing.id,
        scheduledAt: showing.scheduledAt,
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
      .where(
        and(
          eq(showing.organizationId, organizationId),
          eq(showing.status, "agendada"),
          gte(showing.scheduledAt, new Date()),
        ),
      )
      .orderBy(showing.scheduledAt)
      .limit(limit);

    return rows.map((r) => {
      const d = r.scheduledAt instanceof Date ? r.scheduledAt : new Date(r.scheduledAt);
      return {
        month: MONTHS[d.getMonth()] ?? "",
        day: String(d.getDate()).padStart(2, "0"),
        client: r.clientName ?? "Cliente interesado",
        property: r.propTitle ?? "Propiedad",
        time: d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        agent: r.agentName ?? "Asesor asignado",
        operation: (r.propOperation as "renta" | "venta") ?? "venta",
      };
    });
  } catch (err) {
    console.error("[dashboard] Error en getUpcomingVisits:", err);
    return [];
  }
}

/**
 * Retorna las actividades recientes del equipo para la vista de inicio.
 */
export async function getRecentActivity(
  organizationId: string,
  limit = 6,
): Promise<ActivityItem[]> {
  try {
    const db = getDb();

    // 1. Mensajes recientes
    const recentMsgs = await db
      .select({
        id: message.id,
        direction: message.direction,
        body: message.body,
        createdAt: message.createdAt,
        clientName: client.name,
        senderName: user.name,
        aiGenerated: message.aiGenerated,
      })
      .from(message)
      .innerJoin(conversation, eq(message.conversationId, conversation.id))
      .leftJoin(client, eq(conversation.clientId, client.id))
      .leftJoin(user, eq(message.senderUserId, user.id))
      .where(eq(message.organizationId, organizationId))
      .orderBy(desc(message.createdAt))
      .limit(limit);

    // 2. Visitas recientes creadas
    const recentShowings = await db
      .select({
        id: showing.id,
        scheduledAt: showing.scheduledAt,
        createdAt: showing.createdAt,
        propTitle: property.title,
        clientName: client.name,
        agentName: user.name,
      })
      .from(showing)
      .innerJoin(property, eq(showing.propertyId, property.id))
      .leftJoin(candidacy, eq(showing.candidacyId, candidacy.id))
      .leftJoin(client, eq(candidacy.clientId, client.id))
      .leftJoin(user, eq(showing.agentId, user.id))
      .where(eq(showing.organizationId, organizationId))
      .orderBy(desc(showing.createdAt))
      .limit(limit);

    const activities: { date: Date; item: ActivityItem }[] = [];

    for (const m of recentMsgs) {
      const actor = m.aiGenerated
        ? "Agente IA"
        : m.direction === "outbound"
          ? m.senderName ?? "Asesor"
          : m.clientName ?? "Cliente";
      const text =
        m.direction === "inbound"
          ? `envió un mensaje: "${(m.body ?? "").slice(0, 45)}${(m.body?.length ?? 0) > 45 ? "..." : ""}"`
          : `respondió a ${m.clientName ?? "cliente"}`;
      const d = m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt);
      activities.push({
        date: d,
        item: {
          actor,
          text,
          time: timeAgo(d),
        },
      });
    }

    for (const s of recentShowings) {
      const d = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt);
      activities.push({
        date: d,
        item: {
          actor: s.agentName ?? "Asesor",
          text: `agendó visita para ${s.clientName ?? "cliente"} (${s.propTitle ?? "propiedad"})`,
          time: timeAgo(d),
        },
      });
    }

    activities.sort((a, b) => b.date.getTime() - a.date.getTime());
    return activities.slice(0, limit).map((a) => a.item);
  } catch (err) {
    console.error("[dashboard] Error en getRecentActivity:", err);
    return [];
  }
}
