import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * Cifrado de secretos en reposo con AES-256-GCM (Principio I).
 * Formato persistido: { encryptedToken, tokenIv, authTag } en base64.
 */
export interface Sealed {
  encryptedToken: string;
  tokenIv: string;
  authTag: string;
}

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/** Clave maestra (32 bytes) desde `ENCRYPTION_KEY` (base64). */
export function getEncryptionKey(): Buffer {
  const key = Buffer.from(getEnv().ENCRYPTION_KEY, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`ENCRYPTION_KEY debe decodificar a ${KEY_BYTES} bytes (AES-256).`);
  }
  return key;
}

export function seal(plaintext: string, key: Buffer = getEncryptionKey()): Sealed {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedToken: encrypted.toString("base64"),
    tokenIv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function open(sealed: Sealed, key: Buffer = getEncryptionKey()): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.tokenIv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(sealed.encryptedToken, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
