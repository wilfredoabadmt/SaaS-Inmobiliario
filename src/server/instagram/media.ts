import { igGraphRequest } from "@/lib/instagram";

/**
 * Listado de publicaciones recientes de la cuenta conectada (feature 008). Alimenta el
 * selector del panel de comentarios: el dueño elige un post en vez de pegar un media ID
 * (el shortcode de la URL `/p/<code>/` NO sirve; Graph exige el id numérico). Lectura en vivo.
 */

export interface IgMediaItem {
  id: string;
  caption?: string;
  mediaType?: string;
  permalink?: string;
  timestamp?: string;
}

/** `GET /{ig_user_id}/media` — últimas publicaciones (id numérico + caption + permalink). */
export async function listRecentMedia(
  token: string,
  igUserId: string,
  limit = 25,
): Promise<IgMediaItem[]> {
  const res = await igGraphRequest<{
    data?: Array<{
      id: string;
      caption?: string;
      media_type?: string;
      permalink?: string;
      timestamp?: string;
    }>;
  }>(`${igUserId}/media`, {
    method: "GET",
    token,
    searchParams: { fields: "id,caption,media_type,permalink,timestamp", limit: String(limit) },
  });
  return (res.data ?? []).map((m) => ({
    id: m.id,
    caption: m.caption,
    mediaType: m.media_type,
    permalink: m.permalink,
    timestamp: m.timestamp,
  }));
}
