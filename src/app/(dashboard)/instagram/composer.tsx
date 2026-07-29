"use client";

import { useState } from "react";
import { PropertyPicker, type PropertyOption } from "@/components/instagram/property-picker";

type Mode = "manual" | "property";
type Result = { ok: boolean; message: string };

/** Compositor de publicación: imagen suelta (manual) o desde propiedad (feature 008). */
export function Composer({ properties }: { properties: PropertyOption[] }) {
  const [mode, setMode] = useState<Mode>("manual");
  const [file, setFile] = useState<File | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onPickProperty(id: string) {
    setPropertyId(id);
    setResult(null);
    if (!id) {
      setCaption("");
      return;
    }
    try {
      const res = await fetch(`/api/instagram/property-caption?propertyId=${encodeURIComponent(id)}`);
      const data = (await res.json()) as { caption?: string; hasPhoto?: boolean };
      setCaption(data.caption ?? "");
      if (data.hasPhoto === false) {
        setResult({ ok: false, message: "Esta propiedad no tiene fotos; no se puede publicar." });
      }
    } catch {
      /* sin pre-relleno si falla */
    }
  }

  async function uploadManual(f: File): Promise<string> {
    const ct = f.type === "image/png" ? "image/png" : "image/jpeg";
    const res = await fetch("/api/instagram/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: ct }),
    });
    const { uploadUrl, storageKey } = (await res.json()) as {
      uploadUrl: string;
      storageKey: string;
    };
    await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": ct }, body: f });
    return storageKey;
  }

  async function publish() {
    setBusy(true);
    setResult(null);
    try {
      let body: Record<string, unknown>;
      if (mode === "manual") {
        if (!file) {
          setResult({ ok: false, message: "Selecciona una imagen." });
          return;
        }
        const storageKey = await uploadManual(file);
        body = { source: "manual", storageKey, caption: caption || undefined };
      } else {
        if (!propertyId) {
          setResult({ ok: false, message: "Selecciona una propiedad." });
          return;
        }
        body = { source: "property", propertyId, caption: caption || undefined };
      }
      const res = await fetch("/api/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        igMediaId?: string;
        error?: { message?: string; detail?: string };
      };
      if (res.ok) {
        setResult({ ok: true, message: "Publicado correctamente." });
        setFile(null);
        if (mode === "manual") setCaption("");
      } else {
        const base = data.error?.message ?? "No se pudo publicar.";
        setResult({ ok: false, message: data.error?.detail ? `${base} — ${data.error.detail}` : base });
      }
    } catch {
      setResult({ ok: false, message: "Error de red al publicar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-panel p-4">
      <div className="flex gap-2">
        {(["manual", "property"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setResult(null);
            }}
            className={
              "rounded-md px-3 py-1.5 text-[13px] font-[550] transition-colors " +
              (mode === m ? "bg-accent text-white" : "border border-border text-text-2 hover:bg-bg-sunken")
            }
          >
            {m === "manual" ? "Imagen" : "Desde propiedad"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {mode === "manual" ? (
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-[13px] text-text-2 file:mr-3 file:rounded-md file:border file:border-border file:bg-bg file:px-3 file:py-1.5 file:text-[13px] file:text-text-2"
          />
        ) : (
          <PropertyPicker options={properties} value={propertyId} onChange={onPickProperty} />
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={
            mode === "property"
              ? "Caption (se genera desde la propiedad; puedes editarlo)"
              : "Escribe un caption…"
          }
          rows={4}
          maxLength={2200}
          className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-[13px] text-text placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-tint"
        />

        {result && (
          <div
            className={
              "rounded-md px-2.5 py-1.5 text-[12px] " +
              (result.ok
                ? "bg-[color:var(--match-ok-bg)] text-[color:var(--match-ok-text)]"
                : "bg-[color:var(--match-no-bg)] text-[color:var(--match-no-text)]")
            }
          >
            {result.message}
          </div>
        )}

        <button
          type="button"
          onClick={publish}
          disabled={busy}
          className="rounded-md bg-accent px-3.5 py-2 text-[13px] font-[600] text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </div>
  );
}
