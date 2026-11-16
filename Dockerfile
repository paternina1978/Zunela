# Causa del 502: en Linux el contenedor define HOSTNAME=id-del-contenedor.
# Next standalone hace listen(HOSTNAME), así que NO escucha en 0.0.0.0 y
# el proxy de Railway no llega → "Application failed to respond".
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY zunela-web/package.json zunela-web/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY zunela-web/ ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_ZUNELA_BACKEND=supabase
RUN npm run build \
  && test -f .next/standalone/server.js \
  && test -d .next/static

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# Fuerza 0.0.0.0 en el proceso (pisa el HOSTNAME del contenedor).
# PORT lo inyecta Railway; no fijarlo a 3000 aquí.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
