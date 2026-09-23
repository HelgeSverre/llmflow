# AGENTS.md

LLMFlow is a local LLM observability tool: an HTTP proxy for LLM APIs (port 8080) plus a dashboard, JSON API, OTLP receiver and WebSocket feed (port 1337), backed by SQLite. Bun monorepo.

## Status: cleanup milestone in progress

- Milestone `m-0` "Project Cleanup" (34 tasks, TASK-71…104) is restructuring the repo. Run `backlog milestone list` and `backlog task list --plain`; before changing build, tests, packaging, config or docs, read the task that owns that area — its comments carry the decisions and the facts we verified.
- Decisions already made (do not re-open): Bun-only runtime, Node only for `bin/llmflow.js` and Playwright · everything becomes TypeScript ESM, no `require()` in TS · `bun test` for server + packages, Vitest for the dashboard, Playwright in `e2e/` · oxlint + oxfmt replace Prettier (TASK-87) · `apps/server` becomes the published `llmflow` package and the root goes private (TASK-104) · `website/` leaves the workspaces (TASK-101) · unused API routes are deleted (TASK-88).
- Deleted on purpose, recreated by their tasks: `docs/`, `ARCHITECTURE.md` (TASK-102), `RELEASING.md` (TASK-98). Do not restore them from git.

## Runtime and commands (as of 2026-09-23)

- Bun ≥ 1.3.13 required (developed on 1.4.2). `bun install` at the root; the isolated linker gives each workspace its own `node_modules`.
- `bun run dev` — server (`--watch`) and the Vite dashboard together, falling back to free ports; `bun run dev:server` / `bun run dev:dashboard` for one side.
- `bun run test` — server suite (custom runner until TASK-76). `bun run --filter @llmflow/dashboard test` — Vitest. `bunx playwright test` — E2E (builds first).
- `bun run typecheck` — every workspace plus `scripts/`. `bun run lint` (oxlint, `.oxlintrc.json`; `lint:fix` autofixes) · `bun run format` / `bun run format:check` (oxfmt, `.oxfmtrc.json`; Svelte goes through oxfmt's bundled Prettier) · `bun run check` = typecheck + lint + format:check. oxlint only sees `.svelte` `<script>` blocks; `svelte-check` in the dashboard typecheck covers templates.
- `bun run build` → `dist/` (server bundle, dashboard assets, pricing fallback). `bun run test:package` smoke-tests the npm tarball. `just --list` shows all recipes by group.

## Layout

```
apps/server/        Bun server (TS): proxy, dashboard/API/OTLP/WebSocket, replay
apps/dashboard/     Svelte 5 + Vite SPA (Vitest unit tests colocated)
packages/db/        bun:sqlite schema, migrations, queries (TS, ESM)
packages/providers/ provider adapters + passthrough handlers (TS, ESM)
packages/otlp/      OTLP ingest + upstream export (CJS JS, being ported: TASK-82/83)
packages/pricing/   LiteLLM pricing + offline fallback (CJS JS, TASK-81)
packages/shared/    logger + redaction (CJS JS, TASK-80)
packages/sdk/       llmflow-sdk (JS, not yet published: TASK-84)
e2e/playwright/     Playwright specs, seed data, test server
scripts/            dev, build, docker-dev, test-package orchestration
bin/llmflow.js      Node launcher for `npx llmflow`; spawns Bun
docker/ website/ release-notes/ .backlog/
```

## Conventions

- Internal dependencies use `workspace:*`; import packages by name, never by a relative path into another workspace (the remaining violations are tracked in TASK-85/104).
- Style: no semicolons, single quotes, trailing commas, 4-space indent (2-space in `apps/dashboard/**` and Markdown/JSON/YAML). No comments unless the WHY is non-obvious. Minimal dependencies.
- Naming: camelCase in code, UPPER_SNAKE constants, snake_case for DB columns and API JSON.
- Request handlers return an error `Response`; they never throw. Providers extend `BaseProvider` (`packages/providers/src/base.ts`).
- Environment variables are still read ad hoc; TASK-90 centralises them. Do not add new scattered `process.env` reads — extend the existing read site instead.
- Never commit generated output (`dist/`, `apps/dashboard/dist/`, `test-results/`) or private files (`.env`, `*.db`, `.claude-config/`).

## Before marking a task Done

`bun run check` (typecheck + lint + format:check), `bun run test` and the dashboard tests must pass; run Playwright when UI or API behaviour changed and `bun run test:package` when packaging changed. Record verified facts and decisions as task comments so the next task sees them.

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
