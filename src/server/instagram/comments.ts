import { igGraphRequest } from "@/lib/instagram";

/**
 * Moderación de comentarios de Instagram (feature 008, US3). Funciones de transporte que
 * reciben el token del tenant (el route lo carga con `getCredentials`). Lectura en vivo.
 */

export interface IgComment {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
}

/** Lista los comentarios de una publicación. */
export async function listComments(token: string, mediaId: string): Promise<IgComment[]> {
  const res = await igGraphRequest<{ data?: IgComment[] }>(`${mediaId}/comments`, {
    method: "GET",
    token,
    searchParams: { fields: "id,text,username,timestamp" },
  });
  return res.data ?? [];
}

/** Responde a un comentario; devuelve el id de la respuesta. */
export async function replyComment(
  token: string,
  commentId: string,
  message: string,
): Promise<string> {
  const res = await igGraphRequest<{ id: string }>(`${commentId}/replies`, {
    method: "POST",
    token,
    searchParams: { message },
  });
  return res.id;
}

/** Oculta un comentario (sigue existiendo pero no es visible públicamente). */
export async function hideComment(token: string, commentId: string): Promise<void> {
  await igGraphRequest(`${commentId}`, {
    method: "POST",
    token,
    searchParams: { hide: "true" },
  });
}

/** Borra un comentario. */
export async function deleteComment(token: string, commentId: string): Promise<void> {
  await igGraphRequest(`${commentId}`, { method: "DELETE", token });
}
