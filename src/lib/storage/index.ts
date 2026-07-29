import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/lib/env";

/**
 * Wrapper de almacenamiento de objetos sobre la **interfaz S3 estándar** (Principio
 * II). Endpoint/credenciales por env → portable a MinIO sin cambios de código.
 */
let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const env = getEnv();
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function bucket(): string {
  return getEnv().S3_BUCKET;
}

/** URL prefirmada para SUBIR un objeto (PUT directo desde el cliente). */
export function getUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType });
  return getSignedUrl(getClient(), cmd, { expiresIn: expiresInSeconds });
}

/** URL prefirmada para DESCARGAR un objeto. */
export function getDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(getClient(), cmd, { expiresIn: expiresInSeconds });
}

/**
 * Descarga un objeto como **web stream** (feature 008): lo usa la ruta proxy pública de
 * media para servir la imagen a publicar sin cargarla entera en memoria ni exponer la
 * presigned. Devuelve el cuerpo y su `Content-Type`. Lanza si la key no existe.
 */
export async function getObjectStream(
  key: string,
): Promise<{ body: ReadableStream; contentType: string }> {
  const out = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!out.Body) throw new Error(`Objeto no encontrado: ${key}`);
  return {
    body: out.Body.transformToWebStream(),
    contentType: out.ContentType ?? "application/octet-stream",
  };
}

export async function putObject(
  key: string,
  body: Uint8Array | string,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
