# AGENTS.md

## Build & Test
- Runtime: **Bun** (required). Start: `bun run src/server.ts`. Dev: `bun run --hot src/server.ts`
- Frontend (Svelte 5 + Vite): `cd frontend && npm install && npm run dev` (builds to `public/`)
- Tests: `bun run test/run-tests.js` | Single: `bun run test/run-tests.js <filename>` | E2E: `bunx playwright test`
- Typecheck: `bun run frontend/node_modules/.bin/tsc --noEmit -p src/tsconfig.json`

## Architecture
- **src/server.ts** — Main Bun server: dashboard (port 1337) + proxy (port 8080), both auto-detected via `get-port`
- **src/db.ts** — SQLite database (`bun:sqlite`), stores traces/logs/metrics in `~/.llmflow/`
- **providers/** — CommonJS modules: LLM provider adapters (OpenAI, Anthropic, Gemini, etc.) + passthrough handlers
- **frontend/** — Svelte 5 SPA, outputs static files to `public/` served by the dashboard server
- **otlp.js, otlp-logs.js, otlp-metrics.js** — OTLP ingestion; **otlp-export.js** — export to external backends
- **pricing.js** — Cost calculation for 2000+ models; **logger.js** — colored console logger

## Code Style
- Backend: TypeScript (`src/`) with `import` for TS modules + `require()` for local CommonJS (providers, pricing, logger)
- No semicolons in TS files; semicolons in JS files. No linter/formatter configured.
- No comments unless complex logic. Minimal dependencies (only `get-port` in production).
- Naming: camelCase for variables/functions, UPPER_SNAKE for constants, snake_case for DB columns/trace fields
- Error handling: try/catch with `log.error()`, never throw in request handlers — return error Response
- Provider modules follow the `BaseProvider` class pattern in `providers/base.js`
