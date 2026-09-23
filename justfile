set dotenv-load

COMPOSE := "docker compose -f docker/docker-compose.yml"

default:
    @just --list

# Install deps and start server + dashboard together (Vite HMR + automatic port selection)
[group('dev')]
dev:
    bun install
    bun run dev

# Start only the server (when you want to restart the backend by itself)
[group('dev')]
dev-server:
    bun run dev:server

# Start only the dashboard dev server (when you want to restart Vite by itself)
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
test-e2e-ui *args:
    bunx playwright test --ui {{args}}

# Typecheck all workspaces
[group('test')]
typecheck:
    bun run typecheck

# Lint with oxlint
[group('test')]
lint:
    bun run lint

# Apply oxlint autofixes
[group('test')]
lint-fix:
    bun run lint:fix

# Format the whole repo with oxfmt
[group('test')]
format:
    bun run format

# Check formatting without writing
[group('test')]
format-check:
    bun run format:check

# Typecheck, lint, and check formatting
[group('test')]
check:
    bun run check

# Build the dashboard and bundled server
[group('build')]
build:
    bun run build

# Build and run with Docker Compose (foreground)
[group('docker')]
docker:
    bun scripts/docker-dev.ts

[group('docker')]
docker-stop:
    {{ COMPOSE }} down

[group('docker')]
docker-logs:
    {{ COMPOSE }} logs -f

# Show what's running on llmflow ports
[group('ops')]
status:
    @bun scripts/dev.ts status
    @docker ps --filter name=llmflow --format 'Docker: {{"{{.Names}} {{.Ports}}"}}' 2>/dev/null || true

# Remove node_modules and the local database
[group('ops')]
clean:
    rm -rf node_modules
    rm -f "${DB_PATH:-${DATA_DIR:-$HOME/.llmflow}/data.db}" "${DB_PATH:-${DATA_DIR:-$HOME/.llmflow}/data.db}-wal" "${DB_PATH:-${DATA_DIR:-$HOME/.llmflow}/data.db}-shm"
    @echo "cleaned node_modules and database"

# Serve the marketing site locally at http://localhost:4000
[group('website')]
website:
    bun run --cwd website dev

# Regenerate the social/OG image
[group('website')]
website-og:
    bun run --cwd website og

# Deploy a preview build to Vercel
[group('website')]
website-preview:
    bun run --cwd website preview

# Deploy the marketing site to Vercel (production)
[group('website')]
website-deploy:
    bun run --cwd website deploy
