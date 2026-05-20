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

# Run Playwright E2E tests
[group('test')]
test-e2e:
    bunx playwright test

# Run E2E tests with browser visible
[group('test')]
test-e2e-headed:
    bunx playwright test --headed

# Typecheck all workspaces
[group('test')]
typecheck:
    bun run typecheck

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
