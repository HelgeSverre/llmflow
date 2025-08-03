FROM node:18-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY server.js ./
COPY public ./public/

# Create directory for database
RUN mkdir -p /data

# Environment variables
ENV NODE_ENV=production
ENV PROXY_PORT=8080
ENV DASHBOARD_PORT=3000

# Expose ports
EXPOSE 8080 3000

# Run the application
CMD ["node", "server.js"]