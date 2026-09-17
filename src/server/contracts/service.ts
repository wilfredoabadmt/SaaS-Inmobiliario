import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { user } from "@/lib/db/schema/auth";
import { candidacy, contract } from "@/lib/db/schema/domain";
import { deleteObject, getDownloadUrl, getUploadUrl } from "@/lib/storage";
import type {
  ConfirmContractUploadInput,
  ContractStatus,
  SignContractUploadInput,
} from "@/lib/contracts/schemas";

export interface ContractView {
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

export interface SignedContractUpload {
  id: string;
  storageKey: string;
  uploadUrl: string;
}

/**
 * Fase 1: Valida que la candidatura pertenezca al tenant y firma la URL prefirmada PUT para el contrato.
 */
export async function signContractUpload(
  organizationId: string,
  candidacyId: string,
  input: SignContractUploadInput,
): Promise<SignedContractUpload> {
  const db = getDb();
  const [cand] = await db
    .select({ id: candidacy.id })
    .from(candidacy)
    .where(and(eq(candidacy.id, candidacyId), eq(candidacy.organizationId, organizationId)))
    .limit(1);

  if (!cand) {
    throw new Error("Candidatura no encontrada en esta organización");
  }

  const id = newId("contract");
  const storageKey = `contracts/${organizationId}/${candidacyId}/${id}.pdf`;
  const uploadUrl = await getUploadUrl(storageKey, input.contentType, 900);

  return { id, storageKey, uploadUrl };
}

/**
 * Fase 2: Valida aislamiento y persiste el contrato en la base de datos tras subida exitosa.
 */
export async function confirmContract(
  organizationId: string,
  candidacyId: string,
  userId: string,
  input: ConfirmContractUploadInput,
): Promise<void> {
  const db = getDb();
  const expectedPrefix = `contracts/${organizationId}/${candidacyId}/`;
  if (!input.storageKey.startsWith(expectedPrefix)) {
    throw new Error("Clave de almacenamiento inválida para esta candidatura");
  }

  await db.insert(contract).values({
    id: input.id,
    organizationId,
    candidacyId,
    status: "borrador",
    storageKey: input.storageKey,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    uploadedByUserId: userId,
  });
}

/**
 * Retorna los contratos de la candidatura con URL de descarga prefirmada.
 */
export async function listContracts(
  organizationId: string,
  candidacyId: string,
): Promise<ContractView[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: contract.id,
      candidacyId: contract.candidacyId,
      status: contract.status,
      fileName: contract.fileName,
      contentType: contract.contentType,
      sizeBytes: contract.sizeBytes,
      storageKey: contract.storageKey,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      uploaderName: user.name,
    })
    .from(contract)
    .leftJoin(user, eq(contract.uploadedByUserId, user.id))
    .where(
      and(eq(contract.organizationId, organizationId), eq(contract.candidacyId, candidacyId)),
    )
    .orderBy(desc(contract.createdAt));

  return Promise.all(
    rows.map(async (r) => {
      const downloadUrl = await getDownloadUrl(r.storageKey, 900);
      return {
        id: r.id,
        candidacyId: r.candidacyId,
        status: r.status as ContractStatus,
        fileName: r.fileName,
        contentType: r.contentType,
        sizeBytes: r.sizeBytes,
        downloadUrl,
        uploadedByName: r.uploaderName ?? "Asesor",
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    }),
  );
}

/**
 * Actualiza el estado del contrato (borrador -> enviado -> en_negociacion -> firmado).
 */
export async function updateContractStatus(
  organizationId: string,
  contractId: string,
  newStatus: ContractStatus,
): Promise<void> {
  const db = getDb();
  const res = await db
    .update(contract)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(contract.id, contractId), eq(contract.organizationId, organizationId)));

  if (!res) {
    throw new Error("Contrato no encontrado");
  }
}

/**
 * Elimina un contrato tanto de la base de datos como de R2.
 */
export async function deleteContract(
  organizationId: string,
  contractId: string,
): Promise<void> {
  const db = getDb();
  const [ctr] = await db
    .select({ id: contract.id, storageKey: contract.storageKey })
    .from(contract)
    .where(and(eq(contract.id, contractId), eq(contract.organizationId, organizationId)))
    .limit(1);

  if (!ctr) {
    throw new Error("Contrato no encontrado");
  }

  try {
    await deleteObject(ctr.storageKey);
  } catch (err) {
    console.error("Fallo al eliminar contrato en R2:", err);
  }

  await db
    .delete(contract)
    .where(and(eq(contract.id, contractId), eq(contract.organizationId, organizationId)));
}
