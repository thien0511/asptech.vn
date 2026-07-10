FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL is optional during build
ARG DATABASE_URL=""
RUN if [ -n "$DATABASE_URL" ]; then \
      echo "DATABASE_URL provided, generating Prisma client..."; \
      pnpm db:generate; \
    else \
      echo "DATABASE_URL not provided, skipping Prisma generate at build time"; \
    fi
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN corepack enable

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Only run migrations if DATABASE_URL is provided, otherwise just start the app
CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then echo 'WARNING: DATABASE_URL not set, skipping migrations'; node server.js; else echo 'Running migrations...'; pnpm prisma migrate deploy && node server.js; fi"]
