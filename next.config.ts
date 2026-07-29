import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` se activa solo en el build de Docker (Linux). En Windows local,
  // el paso de tracing usa symlinks que requieren privilegios elevados (EPERM).
  output: process.env.NEXT_BUILD_STANDALONE === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Paquetes server-only: se cargan en runtime vía Node (no se empaquetan con
  // webpack). Evita errores de bundling de adaptadores opcionales de Better Auth
  // y mantiene fuera del bundle deps pesadas (postgres, AWS SDK).
  serverExternalPackages: [
    "better-auth",
    "@better-auth/core",
    "@better-auth/kysely-adapter",
    "@better-auth/drizzle-adapter",
    "kysely",
    "postgres",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@playwright/**",
      "node_modules/vitest/**",
      "node_modules/esbuild/**",
      "node_modules/typescript/**",
      "node_modules/@types/**",
      "node_modules/eslint/**",
    ],
  },
};

export default nextConfig;
