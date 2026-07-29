"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Cliente de Better Auth para el navegador (login, sesión, organización). */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});
