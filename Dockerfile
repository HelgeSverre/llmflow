FROM node:18-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy server application files
COPY server/server.js ./
COPY server/public ./public/

# Create directory for data
RUN mkdir -p /data

# Environment variables
ENV NODE_ENV=production
ENV PROXY_PORT=8080
ENV DASHBOARD_PORT=3000
ENV DATA_FILE=/data/llmflow-data.json

# Create volume mount point
VOLUME ["/data"]

# Expose ports
EXPOSE 8080 3000

# Run the application
CMD ["node", "server.js"]