# syntax=docker/dockerfile:1
# Keep the Bun tag in sync with .bun-version (also read by CI via setup-bun).
ARG BUN_VERSION=1.4.2

# The build output is plain JS, so build once on the host platform and only
# assemble the runtime stage per target platform.
FROM --platform=$BUILDPLATFORM oven/bun:${BUN_VERSION} AS build
WORKDIR /app

# Manifests first so source-only changes reuse the install layer.
COPY package.json bun.lock ./
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/server/package.json apps/server/
COPY e2e/playwright/package.json e2e/playwright/
COPY packages/db/package.json packages/db/
COPY packages/dev-runtime/package.json packages/dev-runtime/
COPY packages/otlp/package.json packages/otlp/
COPY packages/pricing/package.json packages/pricing/
COPY packages/providers/package.json packages/providers/
COPY packages/sdk/package.json packages/sdk/
COPY packages/shared/package.json packages/shared/
RUN bun ci

COPY . .
RUN bun run build

FROM oven/bun:${BUN_VERSION} AS runtime
ARG VERSION=dev
ARG REVISION=unknown
ARG CREATED=
LABEL org.opencontainers.image.title="LLMFlow" \
      org.opencontainers.image.description="Local LLM observability: proxy, OTLP receiver and dashboard." \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}" \
      org.opencontainers.image.source="https://github.com/HelgeSverre/llmflow" \
      org.opencontainers.image.url="https://www.llmflow.app" \
      org.opencontainers.image.documentation="https://github.com/HelgeSverre/llmflow#readme" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.authors="Helge Sverre"

WORKDIR /home/bun/app
COPY --from=build /app/apps/server/dist ./dist

# The base image creates user bun (uid/gid 1000) but does not switch to it.
RUN mkdir -p /home/bun/.llmflow && chown bun:bun /home/bun/.llmflow
USER bun

ENV PROXY_PORT=8080 \
    DASHBOARD_PORT=1337 \
    PROXY_HOST=0.0.0.0 \
    DASHBOARD_HOST=0.0.0.0 \
    DATA_DIR=/home/bun/.llmflow

VOLUME ["/home/bun/.llmflow"]
EXPOSE 8080 1337
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD bun -e "fetch('http://localhost:${DASHBOARD_PORT:-1337}/api/health').then(r => process.exit(r.ok ? 0 : 1))" || exit 1
CMD ["bun", "--no-install", "dist/server.js"]
