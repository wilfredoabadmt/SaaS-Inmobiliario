import { randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";
import {
  exchangeCodeForShortToken,
  exchangeShortForLongToken,
  fetchMe,
  subscribeInstagramWebhooks,
} from "@/lib/instagram";
import { hmacSign, hmacVerify } from "@/lib/instagram/media-token";
import { saveCredentials } from "@/server/instagram/credentials";

/**
 * OAuth "Business Login for Instagram" (feature 008). El `state` anti-CSRF es stateless:
 * un payload firmado HMAC con `exp` que codifica la agencia, así el callback sabe a qué
 * tenant pertenece sin tocar BD ni depender de la cookie de sesión (DV-IG-2).
 */

const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const;

/** Firma un `state` para `organizationId` válido `ttlSeconds` (default 10 min). */
export function signState(organizationId: string, ttlSeconds = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${organizationId}.${nonce}.${exp}`;
  const sig = hmacSign(`state:${payload}`);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

/** Verifica el `state`: firma válida y NO expirado → devuelve la agencia, o `null`. */
export function verifyState(state: string): { organizationId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4) return null;
    const [organizationId, nonce, expStr, sig] = parts;
    if (!organizationId || !nonce || !expStr || !sig) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
    if (!hmacVerify(`state:${organizationId}.${nonce}.${expStr}`, sig)) return null;
    return { organizationId };
  } catch {
    return null;
  }
}

/** URL de autorización de Instagram con los scopes de Fase 1 y el `state` firmado. */
export function buildAuthorizeUrl(state: string): string {
  const env = getEnv();
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", env.IG_APP_ID);
  url.searchParams.set("redirect_uri", env.IG_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", IG_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Completa la conexión: code → token corto → token largo → datos de cuenta → guardar
 * cifrado → suscribir webhooks. Lanza si cualquier paso falla (el caller redirige a error).
 */
export async function completeConnection(organizationId: string, code: string): Promise<void> {
  const short = await exchangeCodeForShortToken(code);
  const long = await exchangeShortForLongToken(short.access_token);
  const me = await fetchMe(long.access_token);
  await saveCredentials(organizationId, {
    igUserId: me.user_id,
    username: me.username,
    accessToken: long.access_token,
    expiresInSeconds: long.expires_in,
  });
  await subscribeInstagramWebhooks(long.access_token);
}
