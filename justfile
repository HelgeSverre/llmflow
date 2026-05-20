set dotenv-load

COMPOSE := "docker compose -f docker/docker-compose.yml"

default:
    @just --list

# Install deps and start the server
[group('dev')]
dev:
    bun install
    bun run dev

# Start the dashboard dev server
[group('dev')]
dev-dashboard:
    bun run dev:dashboard

# Generate a sample trace
[group('dev')]
demo:
    bun run demo

# Generate 20 sample traces
[group('dev')]
demo-many:
    bun run demo:many

# Run unit/integration tests (server workspace)
[group('test')]
test:
    bun run test

# Run OTLP traces ingestion tests
[group('test')]
test-otlp:
    bun run test:otlp

# Run WebSocket fanout tests
[group('test')]
test-ws:
    bun run test:ws

# Run OTLP logs ingestion tests
[group('test')]
test-logs:
    bun run test:logs

# Run OTLP metrics ingestion tests
[group('test')]
test-metrics:
    bun run test:metrics

# Run provider adapter unit tests
[group('test')]
test-providers:
    bun run test:providers

# Run provider adapter end-to-end tests
[group('test')]
test-providers-e2e:
    bun run test:providers-e2e

# Run Playwright E2E tests
[group('test')]
test-e2e:
    bunx playwright test

# Run E2E tests with browser visible
[group('test')]
test-e2e-headed:
    bunx playwright test --headed

# Open the Playwright UI runner
[group('test')]
test-e2e-ui:
    bunx playwright test --ui

# Typecheck all workspaces
[group('test')]
typecheck:
    bun run typecheck

# Format all source, dashboard, and markdown files with Prettier
[group('test')]
format:
    bunx prettier --write .

# Check formatting without writing
[group('test')]
format-check:
    bunx prettier --check .

# Build the dashboard
[group('build')]
build:
    bun run build

# Regenerate the social/OG image
[group('build')]
og-image:
    bun apps/server/scripts/generate-og-image.js

# Build and run with Docker Compose (foreground)
[group('docker')]
docker:
    {{ COMPOSE }} up --build

[group('docker')]
docker-stop:
    {{ COMPOSE }} down

[group('docker')]
docker-logs:
    {{ COMPOSE }} logs -f

# Show what's running on llmflow ports
[group('ops')]
status:
    @echo "Bun/Node processes:"
    @ps aux | grep -E "(bun|node).*server" | grep -v grep || echo "  none"
    @echo ""
    @echo "Docker containers:"
    @docker ps | grep llmflow || echo "  none"
    @echo ""
    @echo "Ports:"
    @lsof -i :8080 2>/dev/null | head -2 || echo "  8080: free"
    @lsof -i :3000 2>/dev/null | head -2 || echo "  3000: free"

# Remove node_modules and the local database
[group('ops')]
clean:
    rm -rf node_modules
    rm -f ~/.llmflow/data.db
    @echo "cleaned node_modules and database"

# Deploy the marketing site to Vercel
[group('ops')]
website-deploy:
    cd website && vc --prod
