# AGENTS.md

LLMFlow is a local LLM observability tool: an HTTP proxy for LLM APIs (port 8080) plus a dashboard, JSON API, OTLP receiver and WebSocket feed (port 1337), backed by SQLite. Bun monorepo.

## Status: cleanup milestone in progress

- Milestone `m-0` "Project Cleanup" (34 tasks, TASK-71…104) is restructuring the repo. Run `backlog milestone list` and `backlog task list --plain`; before changing build, tests, packaging, config or docs, read the task that owns that area — its comments carry the decisions and the facts we verified.
- Decisions already made (do not re-open): Bun-only runtime, Node only for `apps/server/bin/llmflow.js` and Playwright · everything becomes TypeScript ESM, no `require()` in TS · `bun test` for server + packages, Vitest for the dashboard, Playwright in `e2e/` · oxlint + oxfmt replace Prettier (TASK-87) · `apps/server` is the published `llmflow` package and the root is a private workspace root (TASK-104) · `website/` leaves the workspaces (TASK-101) · unused API routes are deleted (TASK-88).
- Deleted on purpose, recreated by their tasks: `docs/`, `ARCHITECTURE.md` (TASK-102), `RELEASING.md` (TASK-98). Do not restore them from git.

## Runtime and commands (as of 2026-09-23)

- Bun ≥ 1.3.13 required (developed on 1.4.2). `bun install` at the root (`bun ci` in CI); the isolated linker gives each workspace its own `node_modules`. Versions shared by several workspaces live in the root `catalog` and are referenced as `"catalog:"`.
- Root scripts only forward to workspaces with `bun run --filter`. Plain `--filter` runs in dependency order and waits for each dependency's script to finish, so long-running scripts (`dev`) use `--parallel`.
- `bun run dev` — `apps/server` (`--watch`) and the Vite dashboard as two processes, falling back to free ports; they find each other through `@llmflow/dev-runtime` (a per-checkout state directory, `LLMFLOW_URL` overrides). `bun run dev:server` / `bun run dev:dashboard` for one side, `bun run dev:status` lists them.
- `bun run test` = `test:server` (`bun test --isolate` over `apps/server` and `packages`, `**/live/**` ignored) + `test:dashboard` (Vitest). Filter with `bun test --isolate <path-substring>`. `bun run test:live` runs `apps/server/test/live/` (skipped without API keys). Server tests get an in-process server from `apps/server/test/helpers/test-server.ts` (`startTestServer()`: port 0, temp DB, no pricing fetch or export); subprocess tests use its `isolatedEnv()`. `bunx playwright test` — E2E (builds first).
- `bun run typecheck` — every workspace plus the root `tsconfig.json` (`scripts/`, `playwright.config.ts`); all extend `tsconfig.base.json`. `bun run lint` (oxlint, `.oxlintrc.json`; `lint:fix` autofixes) · `bun run format` / `bun run format:check` (oxfmt, `.oxfmtrc.json`; Svelte goes through oxfmt's bundled Prettier) · `bun run check` = typecheck + lint + format:check. oxlint only sees `.svelte` `<script>` blocks; `svelte-check` in the dashboard typecheck covers templates.
- `bun run build` → `apps/server/dist/` (server bundle, dashboard assets, pricing fallback, licenses). `bun run test:package` packs `apps/server` with `bun pm pack` and smoke-tests the tarball (only bin/, dist/, package.json, README, LICENSE; no `workspace:`/`catalog:` specifiers). `just --list` shows all recipes by group.

## Layout

```
apps/server/        npm package `llmflow`: Bun server (TS) — proxy, dashboard/API/OTLP/WebSocket, replay;
                    bin/llmflow.js (Node launcher for `npx llmflow`, spawns Bun), scripts/ (dev, build)
apps/dashboard/     Svelte 5 + Vite SPA (Vitest unit tests colocated)
packages/db/        bun:sqlite schema, migrations, queries (TS, ESM)
packages/providers/ provider adapters + passthrough handlers (TS, ESM)
packages/otlp/      OTLP ingest + upstream export (TS, ESM)
packages/pricing/   LiteLLM pricing + embedded offline fallback (TS, ESM)
packages/shared/    logger, redaction, bounded body reader (TS, ESM)
packages/sdk/       llmflow-sdk: TS source, tsc build to dist/ on prepack, published on its own
packages/dev-runtime/ dev-server discovery shared by the server and dashboard dev scripts
e2e/playwright/     Playwright specs, seed data, test server
scripts/            root orchestration that imports no workspace code: docker-dev, test-package
docker/ website/ release-notes/ .backlog/
```

## Conventions

- Internal dependencies use `workspace:*`; import packages by name, never by a relative path into another workspace (add a package `exports` entry instead). The `@llmflow/*` packages are bundled into `llmflow`, so they are its `devDependencies`.
- Style: no semicolons, single quotes, trailing commas, 4-space indent (2-space in `apps/dashboard/**` and Markdown/JSON/YAML). No comments unless the WHY is non-obvious. Minimal dependencies.
- Naming: camelCase in code, UPPER_SNAKE constants, snake_case for DB columns and API JSON (no camelCase keys in responses). One name per concept: `service_name` (never "tool"), `request_count`, `avg_duration_ms` / `duration_ms`, `provider` (the upstream, identical for translated and passthrough calls), "passthrough" (never "native" for the mode). A record without a service is `unknown_service` (`DEFAULT_SERVICE_NAME`) on every ingest path. Env vars: `LLMFLOW_URL` (dashboard/API) and `LLMFLOW_PROXY_URL` (proxy) for clients, millisecond settings end in `_MS`, default host `127.0.0.1`.
- Request handlers return an error `Response`; they never throw. Providers extend `BaseProvider` (`packages/providers/src/base.ts`).
- Environment variables: declare every variable in `SETTINGS` and read it through `config` (`packages/shared/src/config.ts`); never read `process.env` elsewhere (a test enforces it; the SDK, `vite.config.ts` and test harnesses are exempt). After changing `SETTINGS`, run `bun run env:docs` to regenerate `.env.example`, the README table and `llmflow --help`.
- npm packages list what they ship in the `files` whitelist of their `package.json`; there is no `.npmignore`. `.dockerignore` keeps the image build context to what `bun install` + `bun run build` need.
- Never commit generated output (`apps/server/dist/`, `apps/dashboard/dist/`, `test-results/`, the `apps/server/README.md`/`LICENSE` copies made by prepack) or private files (`.env`, `*.db`, `.claude-config/`).

## Before marking a task Done

`bun run check` (typecheck + lint + format:check) and `bun run test` (server, packages and dashboard) must pass; run Playwright when UI or API behaviour changed and `bun run test:package` when packaging changed. Record verified facts and decisions as task comments so the next task sees them.

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
