import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * Firma HMAC para (a) el token del **proxy público de media** (DV-IG-4) y (b) el `state`
 * anti-CSRF del OAuth (DV-IG-2), ambos con `MEDIA_PROXY_SIGNING_SECRET`. El proxy es
 * deliberadamente público (lo consumen los servidores de Meta), su seguridad es este
 * token por-objeto con expiración: NO permite enumerar otros objetos del tenant (Principio I).
 */

/** HMAC-SHA256 hex de `data` con el secreto de firma. */
export function hmacSign(data: string): string {
  return createHmac("sha256", getEnv().MEDIA_PROXY_SIGNING_SECRET).update(data).digest("hex");
}

/** Comparación en tiempo constante de una firma contra `data`. */
export function hmacVerify(data: string, signature: string): boolean {
  const expected = Buffer.from(hmacSign(data));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Token del proxy para una `key` de R2 válido hasta `exp` (epoch segundos). */
export function signMediaToken(key: string, exp: number): string {
  return hmacSign(`media:${key}.${exp}`);
}

/** Verifica el token del proxy: firma válida y NO expirado. */
export function verifyMediaToken(key: string, exp: number, token: string): boolean {
  if (!Number.isFinite(exp) || exp < nowSeconds()) return false;
  return hmacVerify(`media:${key}.${exp}`, token);
}

/**
 * URL pública absoluta para que Meta descargue la imagen a publicar. Por defecto vive 1 h
 * (tolera reintentos de descarga de Meta). Codifica cada segmento de la key.
 */
export function buildPublicImageUrl(key: string, ttlSeconds = 3600): string {
  const exp = nowSeconds() + ttlSeconds;
  const token = signMediaToken(key, exp);
  const base = getEnv().APP_BASE_URL.replace(/\/$/, "");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${base}/api/public/media/${encodedKey}?exp=${exp}&token=${token}`;
}
