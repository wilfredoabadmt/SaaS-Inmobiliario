"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import type { DocType } from "@/lib/documents/schemas";

interface DocumentItem {
  id: string;
  type: DocType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  uploadedByName: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<DocType, string> = {
  identificacion: "Identificación",
  comprobante_ingresos: "Comprobante de ingresos",
  otro: "Otro documento",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CandidateDocumentsPanel({ candidacyId }: { candidacyId: string }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<DocType>("identificacion");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    try {
      const res = await fetch(`/api/candidacies/${candidacyId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch {
      // Ignora error transitorio de red
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidacyId]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      // 1. Firmar subida
      const signRes = await fetch(`/api/candidacies/${candidacyId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/pdf",
          sizeBytes: file.size,
          type: selectedType,
        }),
      });

      if (!signRes.ok) {
        const errData = await signRes.json().catch(() => ({}));
        throw new Error(errData.error?.message || "No se pudo autorizar la subida");
      }

      const { id, storageKey, uploadUrl } = await signRes.json();

      // 2. Subir directamente a R2
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error("Fallo al subir el archivo al almacenamiento");
      }

      // 3. Confirmar registro
      const confirmRes = await fetch(`/api/candidacies/${candidacyId}/documents/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          storageKey,
          fileName: file.name,
          contentType: file.type || "application/pdf",
          sizeBytes: file.size,
          type: selectedType,
        }),
      });

      if (!confirmRes.ok) {
        throw new Error("No se pudo registrar el documento subido");
      }

      // Recargar lista
      await loadDocuments();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setError(err.message || "Error al subir documento");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("¿Eliminar este documento del expediente?")) return;
    try {
      const res = await fetch(`/api/candidacies/${candidacyId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch {
      alert("Error al eliminar documento");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-[650] uppercase tracking-wide text-text-4">
          Expediente Documental ({documents.length})
        </h3>
      </div>

      {/* Selector de tipo y botón de subida */}
      <div className="rounded-lg border border-border bg-bg p-2.5">
        <div className="mb-2 flex items-center gap-1.5">
          <label className="text-[11px] font-[550] text-text-3">Tipo:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as DocType)}
            disabled={uploading}
            className="flex-1 rounded border border-border bg-bg-panel px-2 py-1 text-[11.5px] text-text"
          >
            <option value="identificacion">Identificación (INE/Pasaporte)</option>
            <option value="comprobante_ingresos">Comprobante de ingresos</option>
            <option value="otro">Otro (aval, domicilio, RFC)</option>
          </select>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={handleFileSelected}
          disabled={uploading}
          className="hidden"
          id={`doc-upload-${candidacyId}`}
        />

        <label
          htmlFor={`doc-upload-${candidacyId}`}
          className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-bg-panel py-2 text-[12px] font-[550] text-text transition-colors hover:bg-bg-hover ${
            uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin text-accent-text" />
              Subiendo documento…
            </>
          ) : (
            <>
              <Upload size={14} className="text-text-3" />
              Adjuntar {TYPE_LABELS[selectedType].toLowerCase()}
            </>
          )}
        </label>
        {error && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}
      </div>

      {/* Listado de documentos */}
      {loading ? (
        <p className="text-[12px] text-text-4">Cargando expediente…</p>
      ) : documents.length === 0 ? (
        <p className="text-[12px] text-text-4">No hay documentos en el expediente aún.</p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg p-2 text-[12px]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText size={16} className="shrink-0 text-accent-text" />
                <div className="min-w-0">
                  <p className="truncate font-[550] text-text" title={doc.fileName}>
                    {doc.fileName}
                  </p>
                  <p className="text-[10.5px] text-text-4">
                    {TYPE_LABELS[doc.type]} · {formatSize(doc.sizeBytes)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-text-3 hover:bg-bg-hover hover:text-text"
                  title="Descargar documento"
                >
                  <Download size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="rounded p-1 text-text-3 hover:bg-bg-hover hover:text-red-600"
                  title="Eliminar documento"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
