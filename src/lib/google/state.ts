import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * `state` anti-CSRF stateless del OAuth de Google (feature 011, US4). Payload firmado HMAC con
 * `BETTER_AUTH_SECRET` que codifica org + usuario + nonce + exp, así el callback sabe a qué
 * asesor pertenece sin tocar BD ni depender de la cookie de sesión (espejo de Instagram, DV-VS-7).
 */

function sign(payload: string): string {
  return createHmac("sha256", getEnv().BETTER_AUTH_SECRET).update(payload).digest("base64url");
}

/** Firma un `state` para (organizationId, userId) válido `ttlSeconds` (default 10 min). */
export function signState(organizationId: string, userId: string, ttlSeconds = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${organizationId}.${userId}.${nonce}.${exp}`;
  const sig = sign(`gcal:${payload}`);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

/** Verifica el `state`: firma válida y NO expirado → devuelve org+usuario, o `null`. */
export function verifyState(state: string): { organizationId: string; userId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 5) return null;
    const [organizationId, userId, nonce, expStr, sig] = parts;
    if (!organizationId || !userId || !nonce || !expStr || !sig) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
    const expected = sign(`gcal:${organizationId}.${userId}.${nonce}.${expStr}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { organizationId, userId };
  } catch {
    return null;
  }
}
