"use client";

import { useEffect, useState } from "react";

interface IgComment {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
}

interface IgMediaItem {
  id: string;
  caption?: string;
  mediaType?: string;
  permalink?: string;
  timestamp?: string;
}

/** Etiqueta corta de un post para el selector: caption + fecha. */
function mediaLabel(m: IgMediaItem): string {
  const cap = m.caption?.replace(/\s+/g, " ").trim();
  const head = cap ? (cap.length > 48 ? cap.slice(0, 48) + "…" : cap) : "(sin caption)";
  const date = m.timestamp
    ? new Date(m.timestamp).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
    : "";
  return date ? `${head} · ${date}` : head;
}

/** Panel de moderación de comentarios (feature 008, US3). Elige un post → modera sus comentarios. */
export function CommentsPanel() {
  const [posts, setPosts] = useState<IgMediaItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [mediaId, setMediaId] = useState("");
  const [comments, setComments] = useState<IgComment[]>([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string>("");
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/instagram/media");
        const data = (await res.json()) as { media?: IgMediaItem[]; error?: { message?: string; detail?: string } };
        if (!active) return;
        if (res.ok) setPosts(data.media ?? []);
        else setError(data.error?.detail ?? data.error?.message ?? "No se pudieron cargar las publicaciones.");
      } catch {
        if (active) setError("Error de red al cargar las publicaciones.");
      } finally {
        if (active) setLoadingPosts(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function load(id: string) {
    const target = id.trim();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/instagram/comments?mediaId=${encodeURIComponent(target)}`);
      const data = (await res.json()) as {
        comments?: IgComment[];
        error?: { message?: string; detail?: string };
      };
      if (res.ok) {
        setComments(data.comments ?? []);
        setLoadedFor(target);
      } else {
        setError(data.error?.detail ?? data.error?.message ?? "No se pudieron cargar los comentarios.");
      }
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  function onPickPost(id: string) {
    setMediaId(id);
    setReplyFor("");
    setComments([]);
    setLoadedFor("");
    if (id) void load(id);
  }

  async function reply(commentId: string) {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/instagram/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, message: replyText }),
      });
      setReplyFor("");
      setReplyText("");
      await load(mediaId);
    } finally {
      setBusy(false);
    }
  }

  async function moderate(commentId: string, action: "hide" | "delete") {
    setBusy(true);
    try {
      await fetch("/api/instagram/comments/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, action }),
      });
      await load(mediaId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-panel p-4">
      <label className="block text-[12px] font-[550] text-text-2">Publicación a moderar</label>
      <div className="mt-1.5 flex gap-2">
        <select
          value={mediaId}
          onChange={(e) => onPickPost(e.target.value)}
          disabled={loadingPosts}
          className="flex-1 rounded-md border border-border-strong bg-bg px-3 py-2 text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-accent-tint disabled:opacity-60"
        >
          <option value="">
            {loadingPosts ? "Cargando publicaciones…" : "Elige una publicación…"}
          </option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {mediaLabel(p)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => load(mediaId)}
          disabled={busy || !mediaId}
          className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-[600] text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "…" : "Recargar"}
        </button>
      </div>

      {!loadingPosts && posts.length === 0 && !error && (
        <div className="mt-2 text-[12px] text-text-3">La cuenta no tiene publicaciones todavía.</div>
      )}
      {error && (
        <div className="mt-2 break-words text-[12px] text-[color:var(--match-no-text)]">{error}</div>
      )}

      <div className="mt-3 space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border border-border bg-bg p-2.5">
            <div className="text-[12px] text-text-3">@{c.username ?? "usuario"}</div>
            <div className="text-[13px] text-text">{c.text}</div>
            <div className="mt-1.5 flex gap-2 text-[12px]">
              <button type="button" onClick={() => setReplyFor(c.id)} className="text-accent-text">
                Responder
              </button>
              <button type="button" onClick={() => moderate(c.id, "hide")} className="text-text-3">
                Ocultar
              </button>
              <button type="button" onClick={() => moderate(c.id, "delete")} className="text-text-3">
                Borrar
              </button>
            </div>
            {replyFor === c.id && (
              <div className="mt-2 flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Tu respuesta…"
                  className="flex-1 rounded-md border border-border-strong bg-bg px-2 py-1 text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-accent-tint"
                />
                <button
                  type="button"
                  onClick={() => reply(c.id)}
                  disabled={busy}
                  className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-[600] text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            )}
          </div>
        ))}
        {mediaId && loadedFor === mediaId && comments.length === 0 && !busy && (
          <div className="text-[12px] text-text-3">Esta publicación no tiene comentarios.</div>
        )}
      </div>
    </div>
  );
}
