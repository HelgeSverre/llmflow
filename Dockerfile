FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --production

# Core files
COPY server.js ./
COPY db.js ./
COPY pricing.js ./
COPY pricing.fallback.json ./
COPY logger.js ./

# OTLP modules
COPY otlp.js ./
COPY otlp-logs.js ./
COPY otlp-metrics.js ./
COPY otlp-export.js ./

# Providers
COPY providers ./providers/

# Frontend
COPY public ./public/

# Create data directory
RUN mkdir -p /root/.llmflow

ENV NODE_ENV=production
ENV PROXY_PORT=8080
ENV DASHBOARD_PORT=3000
ENV DATA_DIR=/root/.llmflow

VOLUME ["/root/.llmflow"]

EXPOSE 8080 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
