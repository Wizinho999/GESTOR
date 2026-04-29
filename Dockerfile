# ---- Stage 1: Install dependencies ----
FROM node:22 AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ---- Stage 2: Build the application ----
FROM node:22 AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable pnpm && pnpm build

# ---- Stage 3: Production runtime (distroless) ----
FROM gcr.io/distroless/nodejs22-debian12 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["server.js"]
