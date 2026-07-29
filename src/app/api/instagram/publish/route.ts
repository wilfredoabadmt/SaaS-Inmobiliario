import type { NextRequest } from "next/server";
import { authErrorResponse, requireMember } from "@/lib/auth/guards";
import { MetaApiError } from "@/lib/meta";
import { publishSchema } from "@/lib/instagram/schemas";
import { getCredentials, markReconnectRequired } from "@/server/instagram/credentials";
import {
  createMediaContainer,
  isPublishingLimitReached,
  publicImageUrl,
  publishMedia,
  recordPost,
  resolvePropertyPublish,
  waitForMediaReady,
} from "@/server/instagram/publish";

export const dynamic = "force-dynamic";

/** ¿El error de Graph indica token inválido/expirado (→ reconectar)? */
function isTokenError(e: unknown): boolean {
  if (!(e instanceof MetaApiError)) return false;
  if (e.status === 401) return true;
  const body = e.body as { error?: { code?: number } } | undefined;
  return body?.error?.code === 190;
}

/**
 * Causa legible del fallo de publicación para mostrarla al dueño (módulo admin owner-only).
 * Extrae el mensaje de usuario de Graph (`error_user_msg`/`message`) — NUNCA contiene tokens.
 */
function igPublishDetail(e: unknown): string | undefined {
  if (e instanceof MetaApiError) {
    const body = e.body as
      | { error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number } }
      | undefined;
    const err = body?.error;
    const human = err?.error_user_msg || err?.message;
    if (human) {
      const codes = [err?.code, err?.error_subcode].filter((c) => c != null).join("/");
      return codes ? `${human} (${codes})` : human;
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return undefined;
}

/** POST /api/instagram/publish — publicar imagen (genérica o desde propiedad). owner+agent. */
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireMember();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const parsed = publishSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid", message: "Cuerpo inválido" } }, { status: 422 });
  }
  const input = parsed.data;

  const creds = await getCredentials(ctx.organizationId);
  if (!creds) {
    return Response.json(
      { error: { code: "not_connected", message: "Instagram no está conectado" } },
      { status: 409 },
    );
  }
  if (creds.status !== "connected") {
    return Response.json(
      { error: { code: "reconnect_required", message: "Reconecta tu cuenta de Instagram" } },
      { status: 409 },
    );
  }

  // Resolver imagen + caption según el modo.
  let imageKey: string;
  let caption: string | undefined;
  let propertyId: string | null = null;

  if (input.source === "property") {
    const r = await resolvePropertyPublish(ctx.organizationId, input.propertyId, input.caption);
    if (!r.ok) {
      if (r.reason === "property_without_photo") {
        return Response.json(
          { error: { code: "property_without_photo", message: "La propiedad no tiene fotos" } },
          { status: 422 },
        );
      }
      return Response.json(
        { error: { code: "not_found", message: "Propiedad no encontrada" } },
        { status: 404 },
      );
    }
    imageKey = r.imageKey;
    caption = r.caption;
    propertyId = input.propertyId;
  } else {
    if (!input.storageKey.startsWith(`instagram/${ctx.organizationId}/`)) {
      return Response.json(
        { error: { code: "invalid_key", message: "Imagen inválida para esta agencia" } },
        { status: 422 },
      );
    }
    imageKey = input.storageKey;
    caption = input.caption;
  }

  try {
    if (await isPublishingLimitReached(creds.igUserId, creds.token)) {
      return Response.json(
        { error: { code: "rate_limited", message: "Límite diario de publicaciones alcanzado" } },
        { status: 429 },
      );
    }
    const imageUrl = publicImageUrl(imageKey);
    const creationId = await createMediaContainer(creds.igUserId, creds.token, imageUrl, caption);
    // IG procesa el media de forma asíncrona; publicar sin esperar da el error 9007.
    await waitForMediaReady(creds.token, creationId);
    const igMediaId = await publishMedia(creds.igUserId, creds.token, creationId);
    await recordPost({
      organizationId: ctx.organizationId,
      igMediaId,
      propertyId,
      caption: caption ?? null,
      createdBy: ctx.userId,
    });
    return Response.json({ igMediaId }, { status: 200 });
  } catch (e) {
    if (isTokenError(e)) {
      await markReconnectRequired(ctx.organizationId);
      return Response.json(
        { error: { code: "reconnect_required", message: "El token de Instagram expiró" } },
        { status: 409 },
      );
    }
    // El error real de Graph queda solo en runtime (la API REST de Coolify no lo expone),
    // por eso lo devolvemos como `detail` para diagnosticar desde la UI (sin tokens).
    console.error("[ig-publish] fallo", e instanceof MetaApiError ? e.body : e);
    return Response.json(
      {
        error: { code: "publish_failed", message: "No se pudo publicar la imagen", detail: igPublishDetail(e) },
      },
      { status: 502 },
    );
  }
}
