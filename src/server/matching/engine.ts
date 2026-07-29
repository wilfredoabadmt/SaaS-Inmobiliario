import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { property } from "@/lib/db/schema/domain";
import { chatJson } from "@/lib/ai/openrouter";
import { getEnv } from "@/lib/env";
import type { Match, MatchReason, PropertyView } from "@/lib/inbox/types";
import type { RequirementsRow } from "@/server/requirements/service";

type PropertyRow = typeof property.$inferSelect;

const TYPE_LABEL: Record<string, string> = {
  casa: "Casa",
  departamento: "Departamento",
  local: "Local",
  terreno: "Terreno",
};

function num(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function priceLabel(price: string, currency: string): string {
  const n = Number(price);
  const formatted = Number.isFinite(n)
    ? n.toLocaleString("es-MX", { maximumFractionDigits: 0 })
    : price;
  return `$${formatted}${currency && currency !== "MXN" ? ` ${currency}` : ""}`;
}

function specsOf(p: PropertyRow): string {
  const parts: string[] = [];
  if (p.bedrooms != null) parts.push(`${p.bedrooms} rec`);
  if (p.bathrooms != null) parts.push(`${Number(p.bathrooms)} baños`);
  if (p.builtAreaM2 != null) parts.push(`${Number(p.builtAreaM2)} m²`);
  return parts.join(" · ");
}

export function toPropertyView(p: PropertyRow): PropertyView {
  const zone = [p.neighborhood, p.city].filter(Boolean).join(", ");
  return {
    id: p.id,
    title: p.title ?? `${TYPE_LABEL[p.propertyType] ?? "Propiedad"} en ${p.city ?? "—"}`,
    operation: p.operationType,
    zone: zone || "—",
    type: TYPE_LABEL[p.propertyType] ?? p.propertyType,
    priceLabel: priceLabel(p.price, p.currency),
    specs: specsOf(p),
    status: p.status,
    photoSeed: p.id,
  };
}

/**
 * Etapa 1: score determinista de una propiedad contra los requisitos. Exportado para
 * reusarlo en el **match inverso** (propiedad → clientes, feature 007).
 */
export function scoreProperty(
  p: PropertyRow,
  req: RequirementsRow,
): { pct: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  let got = 0;
  let total = 0;

  // Presupuesto (objetivo con tolerancia ±15%, D8).
  const price = Number(p.price);
  const min = num(req.budgetMin);
  const max = num(req.budgetMax);
  if (min != null || max != null) {
    total++;
    const lo = min ?? 0;
    const hi = max ?? Number.POSITIVE_INFINITY;
    const within = price >= lo && price <= hi;
    const near =
      price >= lo * 0.85 && price <= (hi === Number.POSITIVE_INFINITY ? hi : hi * 1.15);
    if (within) {
      got += 1;
      reasons.push({ ok: true, label: "Dentro de presupuesto" });
    } else if (near) {
      got += 0.5;
      reasons.push({ ok: true, label: "Cerca del presupuesto" });
    } else {
      reasons.push({ ok: false, label: "Fuera de presupuesto" });
    }
  }

  // Zona (coincide colonia/ciudad).
  if (req.zone) {
    total++;
    const hay = `${p.neighborhood ?? ""} ${p.city ?? ""}`.toLowerCase();
    const ok = req.zone
      .toLowerCase()
      .split(/[\/,]/)
      .map((z) => z.trim())
      .filter(Boolean)
      .some((z) => hay.includes(z));
    if (ok) {
      got++;
      reasons.push({ ok: true, label: `Zona: ${p.neighborhood ?? p.city}` });
    } else {
      reasons.push({ ok: false, label: `Zona: ${p.neighborhood ?? p.city ?? "—"}` });
    }
  }

  // Tipo de propiedad.
  if (req.propertyType) {
    total++;
    const ok = p.propertyType === req.propertyType;
    got += ok ? 1 : 0;
    reasons.push({ ok, label: TYPE_LABEL[p.propertyType] ?? p.propertyType });
  }

  // Recámaras (>= pedidas).
  if (req.bedrooms != null) {
    total++;
    const ok = (p.bedrooms ?? 0) >= req.bedrooms;
    got += ok ? 1 : 0;
    reasons.push({ ok, label: `${req.bedrooms}+ recámaras` });
  }

  // Baños (>= pedidos).
  if (req.bathrooms != null) {
    total++;
    const ok = Number(p.bathrooms ?? 0) >= Number(req.bathrooms);
    got += ok ? 1 : 0;
    reasons.push({ ok, label: `${Number(req.bathrooms)}+ baños` });
  }

  const pct = total === 0 ? 50 : Math.round((got / total) * 100);
  return { pct, reasons };
}

// ---- Caché por (clientId, version, explain) — proceso long-running (next start). ----
const cache = new Map<string, Match[]>();
const cacheKey = (req: RequirementsRow, explain: boolean) =>
  `${req.clientId}:${req.version}:${explain}`;

/**
 * Vacía la caché de matches en memoria. Útil al resetear una conversación de prueba:
 * tras borrar los requisitos, la próxima calificación re-empieza en `version=1` y no debe
 * leer un ranking cacheado de una corrida anterior con esa misma versión.
 */
export function clearMatchCache(): void {
  cache.clear();
}

const aiSchema = z.object({
  ranking: z.array(z.object({ propertyId: z.string(), pct: z.number(), why: z.string() })),
});

/**
 * Calcula el ranking de matches del tenant para unos requisitos.
 * Etapa 1 determinista (gate operación + score) → top-N; etapa 2 (opt-in `explain`)
 * con `OPENROUTER_MATCH_MODEL` rankea/explica. Cacheado por versión de requisitos.
 * Solo propiedades del tenant (aislamiento). Sin coincidencias → [].
 */
export async function computeMatches(
  organizationId: string,
  req: RequirementsRow,
  opts: { topN?: number; explain?: boolean } = {},
): Promise<Match[]> {
  const topN = opts.topN ?? 5;
  const explain = opts.explain ?? false;
  const key = cacheKey(req, explain);
  const cached = cache.get(key);
  if (cached) return cached.slice(0, topN);

  // Solo disponibles y NO archivadas del tenant; gate por operación si está definida.
  const conds = [
    eq(property.organizationId, organizationId),
    eq(property.status, "disponible"),
    isNull(property.archivedAt),
  ];
  if (req.operation) conds.push(eq(property.operationType, req.operation));
  const props = await getDb()
    .select()
    .from(property)
    .where(and(...conds))
    .limit(100);

  if (props.length === 0) {
    cache.set(key, []);
    return [];
  }

  // Etapa 1: score + orden.
  let matches: Match[] = props
    .map((p) => {
      const { pct, reasons } = scoreProperty(p, req);
      return {
        property: toPropertyView(p),
        pct,
        reasons,
        why: "",
      } satisfies Match;
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, topN);

  // Etapa 2: ranking/explicación con IA (degrada a determinista si falla).
  if (explain && matches.length > 0) {
    try {
      const out = await chatJson({
        model: getEnv().OPENROUTER_MATCH_MODEL,
        schema: aiSchema,
        temperature: 0.2,
        maxTokens: 900,
        system:
          "Eres un motor de matching inmobiliario. Dado los requisitos de un cliente y una lista " +
          "de propiedades candidatas YA prefiltradas, devuelve un ranking con un porcentaje de " +
          "afinidad (0-100 entero) y una explicación breve (1 frase, español de México) por " +
          "propiedad. Usa SOLO las propiedades dadas por su id; no inventes. Pondera presupuesto, " +
          'zona, tipo, recámaras y baños. Responde SOLO JSON: {"ranking":[{"propertyId","pct","why"}]}.',
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              requisitos: {
                operacion: req.operation,
                presupuestoMin: num(req.budgetMin),
                presupuestoMax: num(req.budgetMax),
                zona: req.zone,
                tipo: req.propertyType,
                recamaras: req.bedrooms,
                banos: req.bathrooms != null ? Number(req.bathrooms) : null,
                notas: req.notes,
              },
              candidatas: matches.map((m) => ({
                propertyId: m.property.id,
                titulo: m.property.title,
                operacion: m.property.operation,
                precio: m.property.priceLabel,
                zona: m.property.zone,
                tipo: m.property.type,
                specs: m.property.specs,
              })),
            }),
          },
        ],
      });
      const byId = new Map(out.ranking.map((r) => [r.propertyId, r]));
      matches = matches
        .map((m) => {
          const r = byId.get(m.property.id);
          return r
            ? { ...m, pct: Math.max(0, Math.min(100, Math.round(r.pct))), why: r.why }
            : m;
        })
        .sort((a, b) => b.pct - a.pct);
    } catch (e) {
      // Degradación: nos quedamos con el ranking determinista (panel sigue usable).
      console.error(
        "[matching] IA no disponible; ranking determinista:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  cache.set(key, matches);
  return matches;
}
