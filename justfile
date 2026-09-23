set dotenv-load

COMPOSE := "docker compose -f docker/docker-compose.yml"

# Short aliases for the root package.json scripts; `bun run <script>` works the same.
default:
    @just --list

# Install dependencies, then run the server and the Vite dashboard together
[group('dev')]
dev:
    bun install && bun run dev

# Run only the server (restart the backend on its own)
[group('dev')]
dev-server:
    bun run dev:server

# Run only the Vite dashboard (restart it on its own)
[group('dev')]
dev-dashboard:
    bun run dev:dashboard

# Send sample traces, logs and metrics to the running server
[group('dev')]
demo:
    bun run demo

# Send 20 rounds of sample data to the running server
[group('dev')]
demo-many:
    bun run demo:many

# Run the server from source
[group('dev')]
start:
    bun run start

# Run the server from source with debug logging
[group('dev')]
start-verbose:
    bun run start:verbose

# Run all tests, or `just test <path>` for matching server and package test files
[group('test')]
test *args:
    {{ if args == "" { "bun run test" } else { "bun test --isolate --path-ignore-patterns='**/live/**' " + args } }}

# Run server and package tests
[group('test')]
test-server:
    bun run test:server

# Run dashboard unit tests (Vitest)
[group('test')]
test-dashboard:
    bun run test:dashboard

# Run tests against real provider APIs (billable; skipped without API keys)
[group('test')]
test-live:
    bun run test:live

# Run Playwright end-to-end tests
[group('test')]
test-e2e:
    bun run test:e2e

# Run Playwright tests with the browser visible
[group('test')]
test-e2e-headed:
    bun run test:e2e:headed

# Open the Playwright UI runner
[group('test')]
test-e2e-ui:
    bun run test:e2e:ui

# Pack llmflow and llmflow-sdk and test the tarballs in a clean project
[group('test')]
test-package:
    bun run test:package

# Typecheck, lint, check formatting, then run all tests
[group('check')]
check:
    bun run check && bun run test

# Typecheck every workspace
[group('check')]
typecheck:
    bun run typecheck

# Lint with oxlint
[group('check')]
lint:
    bun run lint

# Apply oxlint autofixes
[group('check')]
lint-fix:
    bun run lint:fix

# Format the repository with oxfmt
[group('check')]
format:
    bun run format

# Check formatting without writing
[group('check')]
format-check:
    bun run format:check

# Build the dashboard and the bundled server into apps/server/dist
[group('build')]
build:
    bun run build

# Bump both packages, write the release notes, commit and tag (never pushes); --dry-run previews
[group('release')]
release *args:
    bun run release {{ args }}

# Regenerate .env.example, the README configuration table and llmflow --help
[group('build')]
env-docs:
    bun run env:docs

# Regenerate the bundled pricing fallback from LiteLLM
[group('build')]
pricing-refresh:
    bun run pricing:refresh

# Build and run with Docker Compose in the foreground, retrying on free ports
[group('docker')]
docker:
    bun scripts/docker-dev.ts

# Stop the Docker Compose service
[group('docker')]
docker-stop:
    {{ COMPOSE }} down

# Follow the Docker Compose logs
[group('docker')]
docker-logs:
    {{ COMPOSE }} logs -f

# Show the running development servers and Docker containers
[group('ops')]
status:
    @bun run dev:status
    @docker ps --filter name=llmflow --format 'Docker: {{"{{.Names}} {{.Ports}}"}}' 2>/dev/null || true

# Remove every node_modules, the build output and the local database
[group('ops')]
clean:
    find . \( -path ./.git -o -path ./.claude \) -prune -o -type d -name node_modules -prune -exec rm -rf {} +
    rm -rf dist apps/server/dist apps/dashboard/dist packages/sdk/dist
    rm -f "${DB_PATH:-${DATA_DIR:-$HOME/.llmflow}/data.db}" "${DB_PATH:-${DATA_DIR:-$HOME/.llmflow}/data.db}-wal" "${DB_PATH:-${DATA_DIR:-$HOME/.llmflow}/data.db}-shm"
    @echo "cleaned node_modules, dist and database"

# Serve the marketing site locally
[group('website')]
website:
    bun run --cwd website dev

# Regenerate the social/OG image
[group('website')]
website-og:
    bun run --cwd website og

# Deploy a preview build of the marketing site to Vercel
[group('website')]
website-preview:
    bun run --cwd website preview

# Deploy the marketing site to Vercel (production)
[group('website')]
website-deploy:
    bun run --cwd website deploy
