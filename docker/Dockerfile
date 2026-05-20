FROM oven/bun:1 AS base
WORKDIR /app

# Install workspace dependencies. Lockfile + every workspace package.json
# go in first so install caches when only sources change.
COPY package.json bun.lock* ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/otlp/package.json ./packages/otlp/package.json
COPY packages/pricing/package.json ./packages/pricing/package.json
COPY packages/providers/package.json ./packages/providers/package.json
COPY packages/sdk/package.json ./packages/sdk/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN bun install --frozen-lockfile --production 2>/dev/null || bun install --production

# Copy source — server + packages it depends on + built dashboard assets.
COPY apps/server ./apps/server/
COPY packages/db ./packages/db/
COPY packages/otlp ./packages/otlp/
COPY packages/pricing ./packages/pricing/
COPY packages/providers ./packages/providers/
COPY packages/shared ./packages/shared/
COPY public ./public/
COPY bin ./bin/
COPY tsconfig.base.json ./tsconfig.base.json

# Create data directory
RUN mkdir -p /root/.llmflow

ENV NODE_ENV=production
ENV PROXY_PORT=8080
ENV DASHBOARD_PORT=3000
ENV DATA_DIR=/root/.llmflow

VOLUME ["/root/.llmflow"]

EXPOSE 8080 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD bun -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1))" || exit 1

CMD ["bun", "run", "apps/server/src/server.ts"]
