"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

/** Cerrar sesión (US2). `authClient.signOut` + redirección a /login. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await authClient.signOut();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <Button type="button" variant="outline" onClick={signOut} disabled={busy}>
      <LogOut size={15} />
      {busy ? "Cerrando…" : "Cerrar sesión"}
    </Button>
  );
}
