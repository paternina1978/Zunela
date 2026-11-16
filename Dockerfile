# App en zunela-web. Root Directory en Railway = vacío (/).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY zunela-web/package.json zunela-web/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY zunela-web/ ./
# Railway inyecta NEXT_PUBLIC_* en el build; no usar ARG vacío que las pise.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_ZUNELA_BACKEND=supabase
RUN npm run build \
  && test -f .next/standalone/server.js \
  && test -d .next/static

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
