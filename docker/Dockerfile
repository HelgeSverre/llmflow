FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
COPY --from=build /app/apps/server/dist ./dist

RUN mkdir -p /root/.llmflow
ENV NODE_ENV=production
ENV PROXY_PORT=8080
ENV DASHBOARD_PORT=1337
ENV PROXY_HOST=0.0.0.0
ENV DASHBOARD_HOST=0.0.0.0
ENV DATA_DIR=/root/.llmflow

VOLUME ["/root/.llmflow"]
EXPOSE 8080 1337
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD bun -e "fetch('http://localhost:${DASHBOARD_PORT:-1337}/api/health').then(r => process.exit(r.ok ? 0 : 1))" || exit 1
CMD ["bun", "--no-install", "dist/server.js"]
