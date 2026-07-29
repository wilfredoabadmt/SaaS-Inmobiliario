import { refreshLongToken } from "@/lib/instagram";
import {
  listCredentialsForRefresh,
  markReconnectRequired,
  updateToken,
} from "@/server/instagram/credentials";

/**
 * Renovación de tokens de Instagram (feature 008, US5, DV-IG-6). Renueva los que expiran en
 * < `thresholdDays`; token inválido → marca la cuenta `reconnect_required` (no afecta a otras).
 */
export async function refreshExpiringTokens(
  thresholdDays = 7,
): Promise<{ refreshed: number; markedReconnect: number }> {
  const before = new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000);
  const creds = await listCredentialsForRefresh(before);

  let refreshed = 0;
  let markedReconnect = 0;

  for (const c of creds) {
    try {
      const res = await refreshLongToken(c.token);
      await updateToken(c.organizationId, res.access_token, res.expires_in);
      refreshed++;
    } catch {
      await markReconnectRequired(c.organizationId);
      markedReconnect++;
    }
  }

  return { refreshed, markedReconnect };
}
