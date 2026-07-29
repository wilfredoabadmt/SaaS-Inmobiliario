"use client";

import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { PHOTO_MAX_BYTES } from "@/lib/properties/schemas";
import type { PropertyPhotoView } from "@/lib/inbox/types";
import { cn } from "@/lib/utils";

/** Normaliza el MIME del archivo a los aceptados (jpeg/png); null si no soportado. */
function normalizeType(t: string): "image/jpeg" | "image/png" | null {
  if (t === "image/jpeg" || t === "image/jpg") return "image/jpeg";
  if (t === "image/png") return "image/png";
  return null;
}

/**
 * Editor de fotos de una propiedad (US3). Subida directa a R2 vía URL prefirmada en 2
 * pasos; reordenar (marcar principal) y eliminar. La principal (sortOrder 0) es la que
 * usa la ficha de WhatsApp (006).
 */
export function PropertyPhotosEditor({
  propertyId,
  photos: initial,
}: {
  propertyId: string;
  photos: PropertyPhotoView[];
}) {
  const [photos, setPhotos] = useState<PropertyPhotoView[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-subir el mismo archivo
    if (!file) return;
    setError(null);

    const contentType = normalizeType(file.type);
    if (!contentType) {
      setError("Solo se aceptan imágenes JPG o PNG.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("La imagen supera el máximo de 10 MB.");
      return;
    }

    setBusy(true);
    try {
      // Paso 1: firmar.
      const signRes = await fetch(`/api/properties/${propertyId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "sign", contentType, sizeBytes: file.size }),
      });
      if (!signRes.ok) {
        setError("No se pudo iniciar la subida.");
        return;
      }
      const { photoId, storageKey, uploadUrl } = (await signRes.json()) as {
        photoId: string;
        storageKey: string;
        uploadUrl: string;
      };

      // Paso 2: PUT directo a R2.
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!putRes.ok) {
        setError("Falló la subida a almacenamiento (¿CORS del bucket?).");
        return;
      }

      // Paso 3: confirmar (crea la fila).
      const confirmRes = await fetch(`/api/properties/${propertyId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "confirm", photoId, storageKey, contentType, sizeBytes: file.size }),
      });
      if (!confirmRes.ok) {
        setError("No se pudo confirmar la foto.");
        return;
      }
      setPhotos(((await confirmRes.json()) as { photos: PropertyPhotoView[] }).photos);
    } catch {
      setError("Error de red al subir la foto.");
    } finally {
      setBusy(false);
    }
  }

  async function makeMain(photoId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "make_main" }),
      });
      if (res.ok) setPhotos(((await res.json()) as { photos: PropertyPhotoView[] }).photos);
    } finally {
      setBusy(false);
    }
  }

  async function remove(photoId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/photos/${photoId}`, {
        method: "DELETE",
      });
      if (res.ok) setPhotos(((await res.json()) as { photos: PropertyPhotoView[] }).photos);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-[650] text-text-2">Fotos ({photos.length})</h3>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-bg-panel px-2.5 py-1.5 text-[12px] font-[550] text-text-2 hover:bg-bg-hover disabled:opacity-50"
        >
          <ImagePlus size={14} />
          Subir foto
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={onPick}
        />
      </div>

      {error && <p className="mb-2 text-[12px] text-red-500">{error}</p>}

      {photos.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-bg px-3 py-6 text-center text-[12.5px] text-text-3">
          Sin fotos. Sube la primera; será la principal de la ficha.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((ph) => (
            <div key={ph.id} className="group relative overflow-hidden rounded-md border border-border">
              {/* URL prefirmada de R2 (host dinámico por env); next/image exigiría whitelistearlo. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt="" className="h-24 w-full object-cover" />
              {ph.isMain && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-ink/85 px-1.5 py-0.5 text-[10px] font-[600] text-white">
                  <Star size={10} /> Principal
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!ph.isMain && (
                  <button
                    type="button"
                    onClick={() => void makeMain(ph.id)}
                    disabled={busy}
                    title="Hacer principal"
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded bg-white/90 text-ink hover:bg-white",
                    )}
                  >
                    <Star size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(ph.id)}
                  disabled={busy}
                  title="Eliminar"
                  className="flex h-6 w-6 items-center justify-center rounded bg-white/90 text-red-500 hover:bg-white"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
