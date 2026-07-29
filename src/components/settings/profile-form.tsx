"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IMAGE_CONTENT_TYPES, IMAGE_MAX_BYTES, type ImageContentType } from "@/lib/images";

interface ProfileFormProps {
  initialName: string;
  email: string;
  roleLabel: string;
  initialAvatarUrl: string | null;
}

/**
 * Perfil personal (US1): edita nombre (PATCH /api/account/profile) y avatar (subida
 * prefirmada a R2 en 2 fases). Email y rol son solo lectura. Tras guardar, `router.refresh()`
 * actualiza el riel (que lee la fila `user` directa).
 */
export function ProfileForm({ initialName, email, roleLabel, initialAvatarUrl }: ProfileFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const initials = (name || email).charAt(0).toUpperCase();

  async function saveName() {
    if (!name.trim() || savingName) return;
    setSavingName(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Nombre actualizado." });
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
      // 1) firmar
      const signRes = await fetch("/api/account/avatar", {
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
      // 2) subir a R2
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!putRes.ok) throw new Error("put");
      // 3) confirmar
      const confirmRes = await fetch("/api/account/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "confirm",
          id,
          storageKey,
          contentType,
          sizeBytes: file.size,
        }),
      });
      if (!confirmRes.ok) throw new Error("confirm");
      const { url } = (await confirmRes.json()) as { url: string | null };
      setAvatarUrl(url);
      setMsg({ ok: true, text: "Foto actualizada." });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "No se pudo subir la imagen. Inténtalo de nuevo." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group relative h-16 w-16 overflow-hidden rounded-full border border-border-strong bg-bg-panel disabled:opacity-60"
          aria-label="Cambiar foto de perfil"
        >
          {avatarUrl ? (
            // URL prefirmada de R2 (host dinámico por env); next/image exigiría whitelistearlo.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl font-[650] text-text-2">
              {initials}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size={18} className="text-white" />
          </span>
        </button>
        <div className="text-[12.5px] text-text-3">
          {uploading ? "Subiendo…" : "JPG, PNG o WebP · máx. 5 MB"}
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

      {/* Nombre */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-name" className="text-sm font-medium text-text-2">
          Nombre
        </label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={savingName}
          maxLength={100}
        />
      </div>

      {/* Email + rol (solo lectura) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-2">Correo</span>
          <div className="flex h-9 items-center rounded-sm border border-border bg-bg-sunken px-3 text-sm text-text-3">
            {email}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-2">Rol</span>
          <div className="flex h-9 items-center rounded-sm border border-border bg-bg-sunken px-3 text-sm text-text-3">
            {roleLabel}
          </div>
        </div>
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
