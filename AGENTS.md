# AGENTS.md

LLMFlow is a local LLM observability tool: an HTTP proxy for LLM APIs (port 8080) plus a dashboard, JSON API, OTLP receiver and WebSocket feed (port 1337), backed by SQLite. Bun monorepo. [ARCHITECTURE.md](ARCHITECTURE.md) describes the modules, data flow, routes and schema; the README covers usage.

## Decisions (do not re-open without a task)

- Bun-only runtime; Node only for `apps/server/bin/llmflow.js`, Node-based tools and Playwright. Everything is TypeScript ESM; no `require()`.
- `bun test` for server and packages, Vitest for the dashboard, Playwright in `e2e/playwright`. oxlint + oxfmt, no Prettier.
- `apps/server` is the published `llmflow` package; the root is a private workspace root; `website/` is outside the workspaces.
- Spans live in the `spans` table and `/api/spans`; "trace" means the group of spans sharing a `trace_id`. The domain vocabulary is [CONTEXT.md](CONTEXT.md); the reasoning behind renames is in ARCHITECTURE.md.
- Backlog tasks carry the verified facts and decisions behind each change: read the task that owns an area (`backlog search <topic> --plain`) before changing build, tests, packaging, config or docs.

## Commands

- Bun ≥ 1.3.13 (CI and Docker use `.bun-version`). `bun install` at the root (`bun ci` in CI); the isolated linker gives each workspace its own `node_modules`. Versions shared by several workspaces live in the root `catalog` (`"catalog:"`).
- Root scripts forward to workspaces with `bun run --filter`; plain `--filter` runs in dependency order, so long-running scripts (`dev`) use `--parallel`. `just --list` shows the same commands as recipes (`just check` also runs the tests; `just test <path>` filters).
- `bun run dev` — server (`--watch`) and Vite dashboard as two processes, on free ports if the preferred ones are busy; they find each other through `@llmflow/dev-runtime` (`LLMFLOW_URL` overrides). `dev:server` / `dev:dashboard` for one side, `dev:status` lists them.
- `bun run test` = `test:server` (`bun test --isolate` over `apps/server` and `packages`, `**/live/**` ignored) + `test:dashboard` (Vitest). Filter with `bun test --isolate <path-substring>`. `bun run test:live` hits real providers (skipped without keys). Server tests get an in-process server from `apps/server/test/helpers/test-server.ts` (`startTestServer()`: port 0, temp DB, no pricing fetch or export); subprocess tests use its `isolatedEnv()`. `bun run test:e2e` runs Playwright (builds first).
- `bun run check` = typecheck (every workspace plus the root `tsconfig.json`; all extend `tsconfig.base.json`) + lint (`.oxlintrc.json`) + format:check (`.oxfmtrc.json`). oxlint sees only `.svelte` `<script>` blocks; `svelte-check` covers templates.
- `bun run build` → `apps/server/dist/` (server bundle with embedded pricing fallback and linked source map, dashboard in `public/`, licenses). `bun run test:package` packs `llmflow` and `llmflow-sdk` with `bun pm pack` and tests both tarballs in a clean project (contents, no `workspace:`/`catalog:` specifiers, no build-machine paths, size limits).

## Layout

```
apps/server/          npm package `llmflow`: server (TS) — src/server.ts wiring, src/api/ route tables,
                      proxy, OTLP routes, replay, WebSocket; bin/llmflow.js launcher; scripts/ (dev, demo, build)
apps/dashboard/       Svelte 5 + Vite SPA (Vitest unit tests colocated)
packages/db/          bun:sqlite schema, versioned migrations, queries, retention
packages/providers/   provider adapters (translated and passthrough), registry, stream parsing, replay keys
packages/otlp/        OTLP decoding and ingestion; OTLP export
packages/pricing/     LiteLLM pricing with embedded offline fallback
packages/shared/      config (every env var), logger, redaction, bounded body reader, network helpers
packages/dev-runtime/ development only: busy-port fallback, discovery between dev servers
packages/sdk/         llmflow-sdk: TS source, tsc build to dist/ on prepack, published on its own
e2e/playwright/       Playwright specs, seed data, test server
scripts/              root tooling: docker-dev, test-package, test-sdk-package, gen-env-docs, refresh-pricing-fallback
docker/ examples/ website/ release-notes/ .backlog/
```

## Conventions

- Internal dependencies use `workspace:*`; import packages by name, never by a relative path into another workspace (add an `exports` entry instead). The `@llmflow/*` packages are bundled into `llmflow`, so they are its `devDependencies`.
- Style: no semicolons, single quotes, trailing commas, 4-space indent (2-space in `apps/dashboard/**` and Markdown/JSON/YAML). No comments unless the WHY is non-obvious. Minimal dependencies.
- Naming: camelCase in code, UPPER_SNAKE constants, snake_case for DB columns and API JSON (no camelCase keys in responses). One name per concept, as defined in the glossary in CONTEXT.md: `service_name`, `request_count`, `avg_duration_ms` / `duration_ms`, `provider`, "passthrough". A record without a service is `unknown_service` (`DEFAULT_SERVICE_NAME`). Client env vars are `LLMFLOW_URL` and `LLMFLOW_PROXY_URL`; millisecond settings end in `_MS`; the default host is `127.0.0.1`.
- API routes are entries in the route tables under `apps/server/src/api/`. Handlers return an error `Response`; they never throw. Providers extend `BaseProvider` (`packages/providers/src/base.ts`), which serves translated and passthrough calls.
- Schema changes are new steps appended to `packages/db/src/migrations.ts`; never edit or reorder an applied step. `packages/db/src/migrations.test.ts` upgrades a real v0.4.1 database and compares the result with a new one.
- Environment variables: declare every variable in `SETTINGS` and read it through `config` (`packages/shared/src/config.ts`); never read `process.env` elsewhere (a test enforces it; the SDK, `vite.config.ts` and test harnesses are exempt). After changing `SETTINGS`, run `bun run env:docs` to regenerate `.env.example`, the README table and `llmflow --help`.
- User-visible changes go into `release-notes/UNRELEASED.md`.
- npm packages list what they ship in the `files` whitelist; there is no `.npmignore`. `.dockerignore` keeps the image build context to what `bun install` + `bun run build` need.
- Never commit generated output (`apps/server/dist/`, `apps/dashboard/dist/`, `packages/sdk/dist/`, `test-results/`, the `apps/server/README.md`/`LICENSE` copies made by prepack) or private files (`.env`, `*.db`, `.claude-config/`). Tests must not write into the repository (e2e screenshots go to `test-results/`).

## Before marking a task Done

`bun run check` and `bun run test` must pass; run `bun run test:e2e` when UI or API behaviour changed and `bun run test:package` when packaging changed. Record verified facts and decisions in the task (notes or comments) so the next task sees them.

## Agent skills

### Issue tracker

Issues, specs and ADRs live in Backlog.md and change only through the `backlog` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as Backlog task labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md`, ADRs as Backlog docs under `adr/`. See `docs/agents/domain.md`.

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.52.0 -->

<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**At the beginning of each conversation in this project, run `backlog instructions overview` before answering or taking action. Re-read it only if you have not read it yet in the current conversation.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:

- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD GUIDELINES END -->
