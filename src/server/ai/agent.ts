import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { organization } from "@/lib/db/schema/auth";
import { client, conversation, conversationProperty, message, property } from "@/lib/db/schema/domain";
import { chatJson } from "@/lib/ai/openrouter";
import { getEnv } from "@/lib/env";
import {
  buildContextBlock,
  buildSystemPrompt,
  type SchedulingContext,
} from "@/server/ai/prompts";
import { computeMatches, toPropertyView } from "@/server/matching/engine";
import {
  getRequirements,
  upsertRequirements,
  type RequirementsPatch,
} from "@/server/requirements/service";
import { formatPropertySheet, isServiceWindowOpen, sendAgentText } from "@/server/inbox/send";
import { sendPropertyCard } from "@/server/inbox/ficha";
import {
  cancelShowing,
  createShowingFromAgent,
  rescheduleShowing,
  resolveAgentId,
} from "@/server/showings/service";
import { computeAvailability } from "@/server/calendar/availability";
import { listActiveShowingsForClient } from "@/server/showings/queries";
import { labelInTz } from "@/lib/time/slots";

// La salida del LLM varía de formato. Validamos LAXO (reply string + objetos) y
// normalizamos en JS plano a tipos estrictos (control total, sin sorpresas de inferencia).
const agentSchema = z.object({
  reply: z.string().min(1).max(2000),
  requirements: z.record(z.string(), z.unknown()).nullish(),
  action: z.record(z.string(), z.unknown()).nullish(),
});

const OPERATIONS = ["renta", "venta"] as const;
const PROPERTY_TYPES = ["casa", "departamento", "local", "terreno"] as const;
const ACTION_TYPES = [
  "none",
  "send_sheet",
  "schedule_visit",
  "reschedule_visit",
  "cancel_visit",
  "handoff",
] as const;
type AgentAction = {
  type: (typeof ACTION_TYPES)[number];
  propertyId: string | null;
  showingId: string | null;
  whenISO: string | null;
  reason: string | null;
};

const lc = (v: unknown): string => (typeof v === "string" ? v.toLowerCase().trim() : "");
function asEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  const s = lc(v);
  return (allowed as readonly string[]).includes(s) ? (s as T) : undefined;
}
function asNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}
function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Normaliza el bloque requirements del modelo (acepta variaciones de formato). */
function normalizeRequirements(raw: Record<string, unknown> | null | undefined): RequirementsPatch {
  const r = raw ?? {};
  return {
    operation: asEnum(r.operation, OPERATIONS),
    budgetMin: asNum(r.budgetMin),
    budgetMax: asNum(r.budgetMax),
    zone: asStr(r.zone),
    propertyType: asEnum(r.propertyType, PROPERTY_TYPES),
    bedrooms: asNum(r.bedrooms),
    bathrooms: asNum(r.bathrooms),
    notes: asStr(r.notes),
  };
}

/** Normaliza la acción: acepta {type,...} y también {name, parameters:{...}}. */
function normalizeAction(raw: Record<string, unknown> | null | undefined): AgentAction {
  const o = raw ?? {};
  const params = (o.parameters ?? o.args ?? {}) as Record<string, unknown>;
  return {
    type: asEnum(o.type ?? o.name ?? o.action, ACTION_TYPES) ?? "none",
    propertyId: asStr(o.propertyId ?? params.propertyId ?? params.property_id) ?? null,
    showingId: asStr(o.showingId ?? params.showingId ?? params.showing_id) ?? null,
    whenISO: asStr(o.whenISO ?? o.when ?? params.whenISO ?? params.when) ?? null,
    reason: asStr(o.reason ?? params.reason) ?? null,
  };
}

/** Frases explícitas que fuerzan handoff aunque el modelo no lo marque (D6). */
function asksForHuman(text: string): boolean {
  return /\b(asesor|una persona|humano|agente humano|hablar con alguien|con una persona)\b/i.test(
    text,
  );
}

/**
 * Procesa un mensaje entrante con el agente de IA (feature 004). Se invoca vía
 * `after()` tras el insert idempotente del entrante, solo si el agente está activo.
 * El SERVIDOR ejecuta las acciones; el modelo solo decide. Degrada con gracia (FR-019).
 */
export async function runAgentForInboundMessage(args: {
  organizationId: string;
  conversationId: string;
}): Promise<void> {
  const { organizationId, conversationId } = args;
  try {
    const db = getDb();

    const convRows = await db
      .select({
        id: conversation.id,
        clientId: conversation.clientId,
        waContactPhone: conversation.waContactPhone,
        assignedAgentId: conversation.assignedAgentId,
        aiEnabled: conversation.aiEnabled,
        needsHuman: conversation.needsHuman,
      })
      .from(conversation)
      .where(
        and(eq(conversation.id, conversationId), eq(conversation.organizationId, organizationId)),
      )
      .limit(1);
    const conv = convRows[0];
    if (!conv || !conv.aiEnabled || conv.needsHuman) return; // gate (opt-in + handoff)

    const [cliRow] = await db
      .select({ name: client.name })
      .from(client)
      .where(eq(client.id, conv.clientId))
      .limit(1);
    const [orgRow] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    const agencyName = orgRow?.name ?? "la agencia";

    // Historial reciente (últimos 20, cronológico).
    const recent = await db
      .select({
        direction: message.direction,
        body: message.body,
        waTimestamp: message.waTimestamp,
        createdAt: message.createdAt,
      })
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .orderBy(desc(message.createdAt))
      .limit(20);
    const history = recent.reverse();
    const lastInbound = [...history].reverse().find((m) => m.direction === "inbound");
    const wantsHuman = asksForHuman(lastInbound?.body ?? "");

    // Ventana de 24 h (RB-1/FR-001/002): si está cerrada, el agente NO puede enviar
    // texto libre (Meta lo rechaza). Cede a humano con motivo y termina, sin registrar
    // ningún envío (FR-003). El asesor puede mandar una plantilla a mano.
    if (!isServiceWindowOpen(lastInbound?.waTimestamp ?? lastInbound?.createdAt ?? null)) {
      await db
        .update(conversation)
        .set({ needsHuman: true, needsHumanReason: "out_of_window" })
        .where(eq(conversation.id, conv.id));
      return;
    }

    // Requisitos + inventario candidato (determinista para latencia).
    const reqRow = await getRequirements(organizationId, conv.clientId);
    const matches = reqRow ? await computeMatches(organizationId, reqRow, { explain: false }) : [];

    // Propiedad de interés: la principal de la conversación (p. ej. tras tocar "Agendar
    // visita" en una tarjeta, feature 006) — para que el agente agende ESA propiedad.
    const interestRows = await db
      .select()
      .from(property)
      .innerJoin(conversationProperty, eq(conversationProperty.propertyId, property.id))
      .where(
        and(
          eq(conversationProperty.conversationId, conversationId),
          eq(conversationProperty.isPrimary, true),
          eq(property.organizationId, organizationId),
        ),
      )
      .limit(1);
    const interestView = interestRows[0]?.property ? toPropertyView(interestRows[0].property) : null;
    const interest = interestView
      ? {
          propertyId: interestView.id,
          titulo: interestView.title,
          operacion: interestView.operation,
          zona: interestView.zone,
          precio: interestView.priceLabel,
        }
      : null;
    // Contexto en formato CRUDO (alineado al JSON que pedimos) para que el modelo no
    // imite el formato "vista" (budgetLabel, tipo capitalizado).
    const reqForPrompt = reqRow
      ? {
          operation: reqRow.operation,
          budgetMin: reqRow.budgetMin != null ? Number(reqRow.budgetMin) : null,
          budgetMax: reqRow.budgetMax != null ? Number(reqRow.budgetMax) : null,
          zone: reqRow.zone,
          propertyType: reqRow.propertyType,
          bedrooms: reqRow.bedrooms,
          bathrooms: reqRow.bathrooms != null ? Number(reqRow.bathrooms) : null,
        }
      : null;

    const chatMsgs = history
      .filter((m) => m.body?.trim())
      .map((m) => ({
        role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: m.body!,
      }));
    if (chatMsgs.length === 0) return;

    // Agendamiento (US2): si hay propiedad de interés o algún match, precomputamos la
    // disponibilidad del asesor de la conversación + sus visitas activas y las inyectamos al
    // contexto. El modelo SOLO elige de esta lista (anti-alucinación); el servidor re-valida.
    const agentId = await resolveAgentId(organizationId, conv.assignedAgentId);
    let scheduling: SchedulingContext | null = null;
    const offeredEpochs = new Set<number>();
    const activeShowingIds = new Set<string>();
    if (agentId && (interest || matches.length > 0)) {
      // Resiliente: si calcular disponibilidad falla (p. ej. un hipo de Google/red), el agente
      // degrada SIN slots en vez de tumbar el turno (regla del proyecto + DV-VS-13).
      try {
        const now = new Date();
        const to = new Date(now.getTime() + 7 * 24 * 3_600_000);
        const avail = await computeAvailability(
          organizationId,
          agentId,
          now.toISOString(),
          to.toISOString(),
        );
        const active = await listActiveShowingsForClient(organizationId, conv.clientId);
        for (const s of avail.slots) offeredEpochs.add(Date.parse(s.startUtc));
        for (const a of active) activeShowingIds.add(a.showingId);
        scheduling = {
          slots: avail.slots.slice(0, 6).map((s) => ({ startUtc: s.startUtc, label: s.label })),
          activeShowings: active.map((a) => ({
            showingId: a.showingId,
            propertyTitle: a.propertyTitle,
            label: labelInTz(a.startUtc, avail.timezone),
          })),
        };
      } catch (e) {
        console.error(
          "[agent] disponibilidad degradada:",
          e instanceof Error ? e.message : String(e),
        );
      }
    }

    const system = `${buildSystemPrompt(agencyName)}\n\n${buildContextBlock(reqForPrompt, matches, interest, scheduling)}`;

    const out = await chatJson({
      model: getEnv().OPENROUTER_AGENT_MODEL,
      schema: agentSchema,
      system,
      messages: chatMsgs,
      maxTokens: 900,
      temperature: 0.5,
    });

    // 1) Calificación: merge de requisitos (solo si vino algún campo concreto).
    const reqPatch = normalizeRequirements(out.requirements);
    if (Object.values(reqPatch).some((v) => v != null)) {
      await upsertRequirements(organizationId, conv.clientId, reqPatch, "ai");
    }

    const convRef = { id: conv.id, waContactPhone: conv.waContactPhone };

    // 2) Respuesta al cliente.
    if (out.reply?.trim()) await sendAgentText(organizationId, convRef, out.reply.trim());

    // 3) Acciones (el servidor valida; el modelo no toca datos).
    // Anti-alucinación: el propertyId de una acción debe ser un match real del tenant o
    // la propiedad de interés actual (feature 006).
    const action = normalizeAction(out.action);
    const validIds = new Set<string>(matches.map((x) => x.property.id));
    if (interestView) validIds.add(interestView.id);

    if (action.type === "send_sheet" && action.propertyId && validIds.has(action.propertyId)) {
      // Ficha como TARJETA (foto + caption + botones); degrada a texto si falla (feature 006).
      try {
        await sendPropertyCard(organizationId, convRef, action.propertyId, {
          withButtons: true,
          aiGenerated: true,
        });
      } catch {
        const m = matches.find((x) => x.property.id === action.propertyId);
        if (m) await sendAgentText(organizationId, convRef, formatPropertySheet(m.property));
      }
    } else if (
      action.type === "schedule_visit" &&
      action.propertyId &&
      action.whenISO &&
      validIds.has(action.propertyId) &&
      offeredEpochs.has(Date.parse(action.whenISO))
    ) {
      // Solo se agenda en un slot REALMENTE ofrecido (anti-alucinación). El servicio re-valida
      // disponibilidad antes de insertar (DV-VS-4).
      await createShowingFromAgent(organizationId, conv.id, action.propertyId, action.whenISO);
    } else if (
      action.type === "reschedule_visit" &&
      action.showingId &&
      action.whenISO &&
      activeShowingIds.has(action.showingId) &&
      offeredEpochs.has(Date.parse(action.whenISO))
    ) {
      await rescheduleShowing(organizationId, action.showingId, action.whenISO);
    } else if (
      action.type === "cancel_visit" &&
      action.showingId &&
      activeShowingIds.has(action.showingId)
    ) {
      await cancelShowing(organizationId, action.showingId);
    }

    // 4) Handoff (acción del modelo o heurística explícita). Motivo: 'requested' (RB-5).
    if (wantsHuman || action.type === "handoff") {
      await db
        .update(conversation)
        .set({ needsHuman: true, needsHumanReason: "requested" })
        .where(eq(conversation.id, conv.id));
    }
  } catch (e) {
    // Degradación visible (RB-4/FR-012/013/014): no se envía nada; se registra sin
    // secretos; la conversación se marca para atención humana con motivo ai_error.
    console.error(
      `[agent] fallo procesando conversación ${conversationId}:`,
      e instanceof Error ? e.message : String(e),
    );
    try {
      await getDb()
        .update(conversation)
        .set({ needsHuman: true, needsHumanReason: "ai_error" })
        .where(
          and(eq(conversation.id, conversationId), eq(conversation.organizationId, organizationId)),
        );
    } catch (e2) {
      console.error(
        `[agent] no se pudo marcar ai_error en ${conversationId}:`,
        e2 instanceof Error ? e2.message : String(e2),
      );
    }
  }
}
