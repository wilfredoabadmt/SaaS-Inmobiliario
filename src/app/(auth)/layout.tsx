import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Guard del grupo `(auth)` (FR-009). Server component: si ya hay sesión, no tiene
 * sentido mostrar registro/login → redirige al panel. Evita el parpadeo de mostrar
 * un formulario a un usuario que ya está autenticado.
 */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/inbox");
  return <>{children}</>;
}
