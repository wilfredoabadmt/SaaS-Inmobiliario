import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { user } from "@/lib/db/schema/auth";
import { candidacy, candidateDocument } from "@/lib/db/schema/domain";
import { deleteObject, getDownloadUrl, getUploadUrl } from "@/lib/storage";
import type {
  ConfirmDocUploadInput,
  DocType,
  SignDocUploadInput,
} from "@/lib/documents/schemas";

function extForMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export interface CandidateDocView {
  id: string;
  candidacyId: string;
  type: DocType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  uploadedByName: string | null;
  createdAt: string;
}

export interface SignedDocUpload {
  id: string;
  storageKey: string;
  uploadUrl: string;
}

/**
 * Fase 1: Valida que la candidatura pertenezca al tenant y firma la URL prefirmada PUT hacia R2.
 */
export async function signCandidateDocUpload(
  organizationId: string,
  candidacyId: string,
  input: SignDocUploadInput,
): Promise<SignedDocUpload> {
  const db = getDb();
  const [cand] = await db
    .select({ id: candidacy.id })
    .from(candidacy)
    .where(and(eq(candidacy.id, candidacyId), eq(candidacy.organizationId, organizationId)))
    .limit(1);

  if (!cand) {
    throw new Error("Candidatura no encontrada en esta organización");
  }

  const id = newId("document");
  const ext = extForMime(input.contentType);
  const storageKey = `candidate-docs/${organizationId}/${candidacyId}/${id}.${ext}`;
  const uploadUrl = await getUploadUrl(storageKey, input.contentType, 900);

  return { id, storageKey, uploadUrl };
}

/**
 * Fase 2: Valida aislamiento y persiste el documento en la base de datos tras subida exitosa.
 */
export async function confirmCandidateDoc(
  organizationId: string,
  candidacyId: string,
  userId: string,
  input: ConfirmDocUploadInput,
): Promise<void> {
  const db = getDb();
  const expectedPrefix = `candidate-docs/${organizationId}/${candidacyId}/`;
  if (!input.storageKey.startsWith(expectedPrefix)) {
    throw new Error("Clave de almacenamiento inválida para esta candidatura");
  }

  await db.insert(candidateDocument).values({
    id: input.id,
    organizationId,
    candidacyId,
    type: input.type,
    storageKey: input.storageKey,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    uploadedByUserId: userId,
  });
}

/**
 * Retorna todos los documentos asociados al expediente del candidato con URL de descarga prefirmada.
 */
export async function listCandidateDocs(
  organizationId: string,
  candidacyId: string,
): Promise<CandidateDocView[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: candidateDocument.id,
      candidacyId: candidateDocument.candidacyId,
      type: candidateDocument.type,
      fileName: candidateDocument.fileName,
      contentType: candidateDocument.contentType,
      sizeBytes: candidateDocument.sizeBytes,
      storageKey: candidateDocument.storageKey,
      createdAt: candidateDocument.createdAt,
      uploaderName: user.name,
    })
    .from(candidateDocument)
    .leftJoin(user, eq(candidateDocument.uploadedByUserId, user.id))
    .where(
      and(
        eq(candidateDocument.organizationId, organizationId),
        eq(candidateDocument.candidacyId, candidacyId),
      ),
    )
    .orderBy(desc(candidateDocument.createdAt));

  return Promise.all(
    rows.map(async (r) => {
      const downloadUrl = await getDownloadUrl(r.storageKey, 900);
      return {
        id: r.id,
        candidacyId: r.candidacyId,
        type: r.type,
        fileName: r.fileName,
        contentType: r.contentType,
        sizeBytes: r.sizeBytes,
        downloadUrl,
        uploadedByName: r.uploaderName ?? "Asesor",
        createdAt: r.createdAt.toISOString(),
      };
    }),
  );
}

/**
 * Elimina un documento del expediente tanto de la base de datos como de R2.
 */
export async function deleteCandidateDoc(
  organizationId: string,
  candidacyId: string,
  documentId: string,
): Promise<void> {
  const db = getDb();
  const [doc] = await db
    .select({ id: candidateDocument.id, storageKey: candidateDocument.storageKey })
    .from(candidateDocument)
    .where(
      and(
        eq(candidateDocument.id, documentId),
        eq(candidateDocument.candidacyId, candidacyId),
        eq(candidateDocument.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!doc) {
    throw new Error("Documento no encontrado");
  }

  // Elimina del bucket de storage (best-effort)
  try {
    await deleteObject(doc.storageKey);
  } catch (err) {
    console.error("Fallo al eliminar archivo en R2:", err);
  }

  // Elimina de la base de datos
  await db
    .delete(candidateDocument)
    .where(
      and(
        eq(candidateDocument.id, documentId),
        eq(candidateDocument.organizationId, organizationId),
      ),
    );
}
