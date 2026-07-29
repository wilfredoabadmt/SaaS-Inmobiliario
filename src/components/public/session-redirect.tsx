"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

/**
 * Redirige a /inbox si el usuario ya tiene sesión activa.
 *
 * Usa `getSession()` dentro de un efecto (solo cliente) en lugar del hook
 * `useSession()`: este último ejecuta hooks de better-auth durante el SSR del
 * client component y rompía el render con
 * "Cannot read properties of null (reading 'useRef')" (la landing devolvía 500).
 * Renderiza null siempre; la landing se muestra normalmente para anónimos.
 */
export function SessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void authClient
      .getSession()
      .then((res) => {
        if (active && res?.data?.user != null) {
          router.replace("/inbox");
        }
      })
      .catch(() => {
        /* sin sesión o error de red: la landing queda visible */
      });
    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
