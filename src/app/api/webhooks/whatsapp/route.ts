import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { verifyWebhookSignature, type WhatsAppWebhookPayload } from "@/lib/meta";
import { processWebhookValue } from "@/server/inbox/ingest";
import { resolveOrgByPhoneNumberId, resolveOrgByWabaId } from "@/server/whatsapp/credentials";
import {
  processTemplateStatusUpdate,
  type TemplateStatusUpdateValue,
} from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

/** GET — verificación de suscripción de Meta. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token === getEnv().META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** POST — eventos entrantes. Firma verificada ANTES de procesar (Principio I/IV). */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(raw, signature)) {
    console.warn("[webhook/whatsapp] firma X-Hub-Signature-256 inválida o ausente");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(raw) as WhatsAppWebhookPayload;
  } catch {
    console.warn("[webhook/whatsapp] body no es JSON válido");
    return new Response("Bad request", { status: 400 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      // Cambios de estatus de plantilla (feature 012): llegan a NIVEL WABA y NO traen
      // phone_number_id (DV-WT-6). Se rutean por entry.id (= waba_id), antes del guard de teléfono.
      if (change.field === "message_template_status_update") {
        const orgId = await resolveOrgByWabaId(entry.id);
        if (orgId) {
          await processTemplateStatusUpdate(orgId, change.value as unknown as TemplateStatusUpdateValue);
        } else {
          console.warn(`[webhook/whatsapp] template_status_update con waba sin organización: ${entry.id}`);
        }
        continue;
      }

      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      // Diagnóstico sin secretos: solo identificadores y conteos (nunca tokens ni texto).
      const messageCount = change.value?.messages?.length ?? 0;
      const statusCount = change.value?.statuses?.length ?? 0;
      const organizationId = await resolveOrgByPhoneNumberId(phoneNumberId);
      if (!organizationId) {
        // Número no mapeado a ninguna agencia → ack y descartar.
        console.warn(
          `[webhook/whatsapp] phone_number_id sin organización: ${phoneNumberId} (mensajes=${messageCount}, estados=${statusCount}) — evento descartado`,
        );
        continue;
      }
      console.info(
        `[webhook/whatsapp] evento aceptado org=${organizationId} phone_number_id=${phoneNumberId} mensajes=${messageCount} estados=${statusCount}`,
      );
      await processWebhookValue(organizationId, change.value);
    }
  }

  return Response.json({ received: true }, { status: 200 });
}
