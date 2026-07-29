import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import * as authSchema from "@/lib/db/schema/auth";

/**
 * Better Auth self-hosted (Principio II) con plugin `organization` para
 * multi-tenancy (organizations = agencias). Roles a nivel de app: owner / agent
 * (ver guards.ts).
 */
export const auth = betterAuth({
  secret: getEnv().BETTER_AUTH_SECRET,
  baseURL: getEnv().BETTER_AUTH_URL,
  database: drizzleAdapter(getDb(), { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true },
  plugins: [organization()],
  databaseHooks: {
    session: {
      create: {
        /**
         * Resolución de organización activa (R1). Better Auth no rellena
         * `activeOrganizationId` al iniciar sesión; sin él `getActiveContext()`
         * devuelve null y el dashboard rebota a /login en bucle. Antes de persistir
         * una sesión nueva, fijamos la primera membresía del usuario como activa.
         * En el registro no hay membresía aún (la sesión se crea antes que la
         * organización); ese caso se cubre con `setActive` explícito en el alta.
         */
        before: async (session) => {
          const rows = await getDb()
            .select({ organizationId: authSchema.member.organizationId })
            .from(authSchema.member)
            .where(eq(authSchema.member.userId, session.userId))
            .orderBy(asc(authSchema.member.createdAt))
            .limit(1);
          const activeOrganizationId = rows[0]?.organizationId;
          if (!activeOrganizationId) return;
          return { data: { ...session, activeOrganizationId } };
        },
      },
    },
  },
});
