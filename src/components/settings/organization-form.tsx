"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IMAGE_CONTENT_TYPES, IMAGE_MAX_BYTES, type ImageContentType } from "@/lib/images";

interface OrganizationFormProps {
  initialName: string;
  initialLogoUrl: string | null;
}

/** Datos de la agencia (US3): nombre (PUT /api/organization) + logo (subida a R2). */
export function OrganizationForm({ initialName, initialLogoUrl }: OrganizationFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName() {
    if (!name.trim() || savingName) return;
    setSavingName(true);
    setMsg(null);
    try {
      const res = await fetch("/api/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Nombre de la agencia actualizado." });
        router.refresh();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setMsg({ ok: false, text: data?.error?.message ?? "No se pudo guardar." });
      }
    } catch {
      setMsg({ ok: false, text: "Error de red. Inténtalo de nuevo." });
    } finally {
      setSavingName(false);
    }
  }

  async function onPickFile(file: File) {
    setMsg(null);
    const contentType = file.type as ImageContentType;
    if (!IMAGE_CONTENT_TYPES.includes(contentType)) {
      setMsg({ ok: false, text: "Formato no válido. Usa JPG, PNG o WebP." });
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setMsg({ ok: false, text: "La imagen supera el límite de 5 MB." });
      return;
    }
    setUploading(true);
    try {
      const signRes = await fetch("/api/organization/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "sign", contentType }),
      });
      if (!signRes.ok) throw new Error("sign");
      const { id, storageKey, uploadUrl } = (await signRes.json()) as {
        id: string;
        storageKey: string;
        uploadUrl: string;
      };
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!putRes.ok) throw new Error("put");
      const confirmRes = await fetch("/api/organization/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "confirm", id, storageKey, contentType, sizeBytes: file.size }),
      });
      if (!confirmRes.ok) throw new Error("confirm");
      const { url } = (await confirmRes.json()) as { url: string | null };
      setLogoUrl(url);
      setMsg({ ok: true, text: "Logo actualizado." });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "No se pudo subir el logo. Inténtalo de nuevo." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border-strong bg-bg-panel disabled:opacity-60"
          aria-label="Cambiar logo de la agencia"
        >
          {logoUrl ? (
            // URL prefirmada de R2 (host dinámico); next/image exigiría whitelistear el host.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={20} className="text-text-4" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <ImagePlus size={18} className="text-white" />
          </span>
        </button>
        <div className="text-[12.5px] text-text-3">
          {uploading ? "Subiendo…" : "Logo · JPG, PNG o WebP · máx. 5 MB"}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_CONTENT_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPickFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="org-name" className="text-sm font-medium text-text-2">
          Nombre de la agencia
        </label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={savingName}
          maxLength={100}
        />
      </div>

      {msg && (
        <p className={msg.ok ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{msg.text}</p>
      )}

      <Button type="button" onClick={saveName} disabled={savingName || !name.trim()}>
        {savingName ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
