"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileCheck, Loader2, Trash2, Upload } from "lucide-react";
import type { ContractStatus } from "@/lib/contracts/schemas";

interface ContractItem {
  id: string;
  candidacyId: string;
  status: ContractStatus;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  uploadedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  borrador: "Borrador",
  enviado: "Enviado a cliente",
  en_negociacion: "En negociación",
  firmado: "Firmado",
};

const STATUS_COLORS: Record<ContractStatus, string> = {
  borrador: "bg-bg-sunken text-text-3 border-border",
  enviado: "bg-blue-50 text-blue-700 border-blue-200",
  en_negociacion: "bg-amber-50 text-amber-800 border-amber-200",
  firmado: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContractTracker({ candidacyId }: { candidacyId: string }) {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadContracts() {
    try {
      const res = await fetch(`/api/candidacies/${candidacyId}/contracts`);
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
      }
    } catch {
      // Ignora error transitorio
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidacyId]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      // 1. Firmar subida
      const signRes = await fetch(`/api/candidacies/${candidacyId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: "application/pdf",
          sizeBytes: file.size,
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
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error("Fallo al subir el archivo al almacenamiento");
      }

      // 3. Confirmar registro
      const confirmRes = await fetch(`/api/candidacies/${candidacyId}/contracts/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          storageKey,
          fileName: file.name,
          contentType: "application/pdf",
          sizeBytes: file.size,
        }),
      });

      if (!confirmRes.ok) {
        throw new Error("No se pudo registrar el contrato subido");
      }

      await loadContracts();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setError(err.message || "Error al subir contrato");
    } finally {
      setUploading(false);
    }
  }

  async function handleStatusChange(contractId: string, newStatus: ContractStatus) {
    setUpdatingId(contractId);
    try {
      const res = await fetch(`/api/candidacies/${candidacyId}/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setContracts((prev) =>
          prev.map((c) => (c.id === contractId ? { ...c, status: newStatus } : c)),
        );
      }
    } catch {
      alert("Error al actualizar estado del contrato");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(contractId: string) {
    if (!confirm("¿Eliminar este contrato?")) return;
    try {
      const res = await fetch(`/api/candidacies/${candidacyId}/contracts/${contractId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setContracts((prev) => prev.filter((c) => c.id !== contractId));
      }
    } catch {
      alert("Error al eliminar contrato");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-[650] uppercase tracking-wide text-text-4">
          Contrato ({contracts.length})
        </h3>
      </div>

      {/* Botón de subida */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelected}
          disabled={uploading}
          className="hidden"
          id={`contract-upload-${candidacyId}`}
        />
        <label
          htmlFor={`contract-upload-${candidacyId}`}
          className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-bg py-2 text-[12px] font-[550] text-text transition-colors hover:bg-bg-hover ${
            uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin text-accent-text" />
              Subiendo contrato…
            </>
          ) : (
            <>
              <Upload size={14} className="text-text-3" />
              Subir contrato PDF
            </>
          )}
        </label>
        {error && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}
      </div>

      {/* Listado de contratos */}
      {loading ? (
        <p className="text-[12px] text-text-4">Cargando contratos…</p>
      ) : contracts.length === 0 ? (
        <p className="text-[12px] text-text-4">No se ha subido ningún contrato aún.</p>
      ) : (
        <div className="space-y-2">
          {contracts.map((ctr) => (
            <div
              key={ctr.id}
              className="rounded-lg border border-border bg-bg p-3 shadow-sm space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck size={18} className="shrink-0 text-accent-text" />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-[600] text-text" title={ctr.fileName}>
                      {ctr.fileName}
                    </p>
                    <p className="text-[10.5px] text-text-4">
                      {formatSize(ctr.sizeBytes)} · Por {ctr.uploadedByName}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={ctr.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded p-1 text-text-3 hover:bg-bg-hover hover:text-text"
                    title="Descargar contrato"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(ctr.id)}
                    className="rounded p-1 text-text-3 hover:bg-bg-hover hover:text-red-600"
                    title="Eliminar contrato"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Selector de estado */}
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <span className="text-[11px] font-[550] text-text-3">Estado:</span>
                <select
                  value={ctr.status}
                  onChange={(e) => handleStatusChange(ctr.id, e.target.value as ContractStatus)}
                  disabled={updatingId === ctr.id}
                  className={`rounded border px-2 py-0.5 text-[11.5px] font-[600] ${STATUS_COLORS[ctr.status]}`}
                >
                  <option value="borrador">Borrador</option>
                  <option value="enviado">Enviado a cliente</option>
                  <option value="en_negociacion">En negociación</option>
                  <option value="firmado">✓ Firmado</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
