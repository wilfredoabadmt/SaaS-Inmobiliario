import type { IgWebhookPayload } from "@/lib/instagram";
import { resolveOrgByIgUserId } from "@/server/instagram/credentials";
import { recordInboundDm } from "@/server/instagram/messaging";

/**
 * Procesamiento del webhook de Instagram (feature 008, US4). Enruta por `ig_user_id`
 * (entry.id) al tenant (DV-IG-8), persiste DMs entrantes de forma idempotente (dedup por
 * `mid`, FR-023) e ignora echos. Los comentarios se moderan on-demand (US3); aquí solo se
 * reconoce el evento (sin efecto duplicable). La firma se valida ANTES en el route.
 */
export async function processIgWebhook(payload: IgWebhookPayload): Promise<void> {
  if (payload.object !== "instagram") return;

  for (const entry of payload.entry ?? []) {
    const igUserId = entry.id;
    const organizationId = await resolveOrgByIgUserId(igUserId);
    if (!organizationId) {
      // Cuenta no mapeada a ninguna agencia → descartar con registro (sin tokens).
      console.warn(`[ig-webhook] evento de cuenta no mapeada: ${igUserId}`);
      continue;
    }

    for (const m of entry.messaging ?? []) {
      if (!m.message || m.message.is_echo) continue;
      const mid = m.message.mid;
      if (!mid) continue;
      await recordInboundDm({
        organizationId,
        counterpartyIgsid: m.sender.id,
        text: m.message.text ?? null,
        igMessageId: mid,
      });
    }

    // entry.changes (field "comments"): sin consumidor persistente en Fase 1.
  }
}
