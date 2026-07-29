import { EmbeddedSignupButton } from "@/components/whatsapp/embedded-signup-button";
import { ManualConnectForm } from "@/components/whatsapp/manual-connect-form";
import { getActiveContext } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { getConnectionStatus } from "@/server/whatsapp/credentials";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  expired: "Expirado",
  none: "Sin conectar",
};

export default async function WhatsAppSettingsPage() {
  const ctx = await getActiveContext();
  if (!ctx || ctx.role !== "owner") {
    return (
      <div className="p-6 text-sm text-text-3">
        Solo el dueño de la agencia puede conectar WhatsApp.
      </div>
    );
  }

  const connection = await getConnectionStatus(ctx.organizationId);
  const env = getEnv();

  return (
    <div className="max-w-xl p-6">
      <h1 className="text-xl font-[650]">Conexión de WhatsApp</h1>
      <p className="mt-1 text-sm text-text-3">
        Conecta el número de tu agencia mediante Embedded Signup, sin escribir código.
      </p>

      <div className="mt-4 rounded-lg border border-border bg-bg-panel p-4">
        <div className="text-sm text-text-2">
          Estado:{" "}
          <span className="font-[600] text-accent-text">
            {STATUS_LABEL[connection.status] ?? connection.status}
          </span>
        </div>
        {connection.displayPhoneNumber && (
          <div className="mt-1 text-sm text-text-2">Número: {connection.displayPhoneNumber}</div>
        )}
        <div className="mt-4">
          <EmbeddedSignupButton
            appId={env.META_APP_ID}
            configId={env.META_CONFIG_ID}
            graphVersion={env.META_GRAPH_API_VERSION}
          />
        </div>
      </div>

      <ManualConnectForm hasConnection={connection.status !== "none"} />
    </div>
  );
}
