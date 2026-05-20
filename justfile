set dotenv-load

COMPOSE := "docker compose -f docker/docker-compose.yml"

default:
    @just --list

# Install deps and start the server
dev:
    bun install
    bun run dev

# Start the dashboard dev server
dev-dashboard:
    bun run dev:dashboard

# Generate a sample trace
demo:
    bun run demo

# Generate 20 sample traces
demo-many:
    bun run demo:many

# Run unit/integration tests (server workspace)
test:
    bun run test

# Run Playwright E2E tests
test-e2e:
    bunx playwright test

# Run E2E tests with browser visible
test-e2e-headed:
    bunx playwright test --headed

# Typecheck all workspaces
typecheck:
    bun run typecheck

# Build the dashboard
build:
    bun run build

# Build and run with Docker Compose (foreground)
docker:
    {{ COMPOSE }} up --build

docker-stop:
    {{ COMPOSE }} down

docker-logs:
    {{ COMPOSE }} logs -f

# Show what's running on llmflow ports
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
clean:
    rm -rf node_modules
    rm -f ~/.llmflow/data.db
    @echo "cleaned node_modules and database"

# Deploy the marketing site to Vercel
website-deploy:
    cd website && vc --prod

# Regenerate the social/OG image
og-image:
    bun apps/server/scripts/generate-og-image.js
