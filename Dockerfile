# syntax=docker/dockerfile:1
# Multi-stage; salida Next standalone. Las migraciones corren en el ARRANQUE del contenedor
# (`node migrate.mjs && node server.js`) con un bundle auto-contenido del migrador de
# drizzle-orm. Se hace al boot (no como Pre-Deployment Command de Coolify) porque Coolify
# ejecuta el pre-deploy vía `docker exec` sobre el contenedor VIEJO, que aún no tiene los
# .sql/migrador nuevos; al boot, la imagen nueva migra su propia BD antes de servir.

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
# pnpm-workspace.yaml lleva la allowlist de build scripts (esbuild/sharp/unrs-resolver);
# debe estar ANTES del install o pnpm 11 falla con ERR_PNPM_IGNORED_BUILDS.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
# Cache del store de pnpm entre builds (BuildKit): reusa paquetes ya descargados en vez
# de bajarlos de cero cada deploy. El mount NO va a la imagen final (no la engorda).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_BUILD_STANDALONE=1
# Cache incremental de compilación de Next (`.next/cache`) entre builds: reusa módulos ya
# compilados → el `next build` deja de ser siempre en frío. Mayor palanca en CPU del KVM1.
RUN --mount=type=cache,id=next,target=/app/.next/cache pnpm build
# Migrador de prod auto-contenido: bundlea el migrador de drizzle-orm + postgres en un
# único archivo (el standalone no trae drizzle-kit). Se ejecuta vía Pre-Deployment Command.
RUN pnpm exec esbuild scripts/migrate.mjs --bundle --platform=node --format=esm --outfile=migrate.mjs

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrador bundleado + carpeta de migraciones (se corren al boot: ver CMD).
COPY --from=builder --chown=nextjs:nodejs /app/migrate.mjs ./migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
# Healthcheck → GET /api/health (verifica DB). start-period holgado: el boot migra antes de servir.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"
# Migra (idempotente; falla el boot si la migración falla → no se sirve esquema inconsistente)
# y luego arranca el servidor.
CMD ["sh", "-c", "node migrate.mjs && node server.js"]
