import { getActiveContext } from "@/lib/auth/guards";
import { isInstagramConfigured } from "@/lib/env";
import { getConnectionStatus } from "@/server/instagram/credentials";
import { InstagramConnectCard } from "@/components/instagram/instagram-connect-card";

export const dynamic = "force-dynamic";

export default async function InstagramSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ig?: string; reason?: string }>;
}) {
  const ctx = await getActiveContext();
  if (!ctx || ctx.role !== "owner") {
    return (
      <div className="p-6 text-sm text-text-3">
        Solo el dueño de la agencia puede conectar Instagram.
      </div>
    );
  }

  const { ig, reason } = await searchParams;
  const connection = await getConnectionStatus(ctx.organizationId);
  const configured = isInstagramConfigured();

  return (
    <div className="max-w-xl p-6">
      <h1 className="text-xl font-[650]">Conexión de Instagram</h1>
      <p className="mt-1 text-sm text-text-3">
        Conecta la cuenta de Instagram de tu agencia para publicar, moderar comentarios y mensajear.
      </p>

      {ig === "connected" && (
        <div className="mt-3 rounded-md border border-accent/20 bg-accent-tint px-3 py-2 text-[12.5px] text-accent-text">
          Cuenta de Instagram conectada correctamente.
        </div>
      )}
      {ig === "error" && (
        <div className="mt-3 rounded-md bg-[color:var(--match-no-bg)] px-3 py-2 text-[12.5px] text-[color:var(--match-no-text)]">
          No se pudo conectar la cuenta. Intenta de nuevo.
          {reason && (
            <span className="mt-1 block break-words font-mono text-[11px] opacity-80">
              Detalle: {reason}
            </span>
          )}
        </div>
      )}

      {!configured && (
        <div className="mt-3 rounded-md border border-border bg-bg-sunken px-3 py-2 text-[12.5px] text-text-3">
          La integración de Instagram aún no está configurada en este entorno.
        </div>
      )}

      <div className="mt-4">
        <InstagramConnectCard
          status={connection.status}
          username={connection.username}
          tokenExpiresAt={connection.tokenExpiresAt ? connection.tokenExpiresAt.toISOString() : null}
          disabled={!configured}
        />
      </div>
    </div>
  );
}
