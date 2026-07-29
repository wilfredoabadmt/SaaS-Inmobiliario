import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { getActiveContext } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { property } from "@/lib/db/schema/domain";
import { getConnectionStatus } from "@/server/instagram/credentials";
import { InstagramModule } from "./instagram-module";

export const dynamic = "force-dynamic";

export default async function InstagramPage() {
  const ctx = await getActiveContext();
  if (!ctx) {
    return <div className="p-6 text-sm text-text-3">Inicia sesión para usar Instagram.</div>;
  }

  const connection = await getConnectionStatus(ctx.organizationId);
  if (connection.status !== "connected") {
    return (
      <div className="mx-auto max-w-[880px] p-8">
        <h1 className="text-xl font-[650]">Instagram</h1>
        <div className="mt-4 rounded-lg border border-dashed border-border bg-bg-panel p-6 text-center">
          <p className="text-[13px] text-text-2">Conecta tu cuenta de Instagram para empezar.</p>
          <Link
            href="/settings/instagram"
            className="mt-3 inline-block rounded-md bg-accent px-3 py-1.5 text-[13px] font-[600] text-white hover:bg-accent-hover"
          >
            Ir a conectar
          </Link>
        </div>
      </div>
    );
  }

  const properties = await getDb()
    .select({
      id: property.id,
      title: property.title,
      operationType: property.operationType,
      propertyType: property.propertyType,
    })
    .from(property)
    .where(and(eq(property.organizationId, ctx.organizationId), isNull(property.archivedAt)));

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    label: p.title?.trim() || `${p.propertyType} (${p.operationType})`,
  }));

  return (
    <div className="mx-auto max-w-[880px] p-8">
      <h1 className="text-xl font-[650]">Instagram · @{connection.username}</h1>
      <p className="mt-1 text-sm text-text-3">Publica, modera comentarios y responde mensajes.</p>
      <div className="mt-5">
        <InstagramModule properties={propertyOptions} igUserId={connection.igUserId ?? ""} />
      </div>
    </div>
  );
}
