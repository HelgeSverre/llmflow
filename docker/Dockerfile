FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies (if any)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production 2>/dev/null || bun install --production

# Copy source files
COPY src ./src/
COPY providers ./providers/
COPY public ./public/
COPY pricing.js ./
COPY pricing.fallback.json ./
COPY logger.js ./
COPY otlp.js ./
COPY otlp-logs.js ./
COPY otlp-metrics.js ./
COPY otlp-export.js ./

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

CMD ["bun", "run", "src/server.ts"]
