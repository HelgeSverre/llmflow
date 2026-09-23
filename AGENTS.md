# AGENTS.md

## Build & Test

- Runtime: **Bun** (required; Node is only used by the `npx llmflow` launcher and Playwright). Workspaces: see `workspaces` in the root `package.json`.
- Install: `bun install` at repo root (isolated linker: each workspace gets its own `node_modules`).
- Both at once: `bun run dev` (root) — `scripts/dev.ts` runs the server (with `--watch`) and the dashboard's Vite dev server together and picks free ports if the defaults are busy.
- Server only: `bun run dev:server` (root) or `bun run --filter @llmflow/server dev`.
- Dashboard only: `bun run dev:dashboard` (root) or `bun run --filter @llmflow/dashboard dev`.
- Tests (server): `bun run test` (root). Dashboard unit tests: `bun run --filter @llmflow/dashboard test`.
- E2E (Playwright): `bunx playwright test`.
- Typecheck: `bun run typecheck` (all workspaces + `scripts/`).

## Layout

```
apps/
  server/       Bun server (TS): proxy on 8080, dashboard on 1337, OTLP ingest, websocket fanout
  dashboard/    Svelte 5 + Vite SPA; build output → apps/dashboard/dist/, assembled into dist/public/ for shipping
packages/
  db/           bun:sqlite schema + queries (TS, ESM). The safeJson helper lives here.
  providers/    LLM provider adapters (OpenAI, Anthropic, Gemini, …) + passthrough handlers (TypeScript, ESM).
  otlp/         OTLP/HTTP ingestion (traces / logs / metrics) + export to upstream backends (CJS).
                Sessions: `traces.session_id` (nullable) groups multiple traces. Filled by OTLP
                ingest from `session.id`, `langsmith.trace.session_id`, `traceloop.association.properties.session_id`,
                `ai.telemetry.metadata.sessionId`, or `service.instance.id`. `traces.conversation_id`
                holds `gen_ai.conversation.id` for chat threads. See `packages/otlp/src/traces.js`.
  pricing/      LiteLLM-backed cost calculation + bundled pricing.fallback.json (CJS).
  shared/       logger + cross-cutting utilities (CJS).
  sdk/          Published as `llmflow-sdk` on npm. Workspace-internal name still `llmflow-sdk`.
bin/            CLI entry: `npx llmflow` → bin/llmflow.js (spawns bundled dist/server.js, or source in an unbuilt checkout).
docker/         Dockerfile + docker-compose.yml.
e2e/playwright/ Playwright specs + fixtures.
dist/           Generated server bundle, dashboard assets in public/, and runtime data; ignored by Git.
website/        Marketing site, screenshots, llms.txt, and image-generation scripts (private workspace).
release-notes/  v*.md per release.
```

## Cross-package import idiom

```ts
// In TypeScript (apps/server/src/server.ts)
import * as db from '@llmflow/db' // ESM, typed
import { safeJson } from '@llmflow/db'
const log = require('@llmflow/shared/logger') // CJS
import { registry } from '@llmflow/providers' // ESM, typed
const { processOtlpTraces } = require('@llmflow/otlp/traces') // CJS sub-path
```

`@llmflow/db` and `@llmflow/providers` are ESM/TypeScript; OTLP, pricing, and shared remain CJS.

## Code Style

- Backend: TS in `apps/server/src/`, `packages/db/src/`, and `packages/providers/src/`; CJS in OTLP, pricing, and shared (transitional).
- Formatting: Prettier (`just format` / `just format-check`). No semicolons, single quotes, trailing commas, 4-space indent for backend / 2-space for `apps/dashboard/**` and Markdown/JSON/YAML.
- No comments unless WHY is non-obvious. Minimal dependencies; OTLP protobuf decoding uses `protobufjs` with a pinned generated schema.
- Naming: camelCase for variables/functions, UPPER_SNAKE for constants, snake_case for DB columns/trace fields.
- Error handling: try/catch with `log.error(...)`, never throw in request handlers — return error Response.
- Provider modules follow the `BaseProvider` class pattern in `packages/providers/src/base.ts`.
- All workspace dep paths use `workspace:*`. Don't hardcode versions for internal packages.

## Backlog

Tasks live in `.backlog/` and are managed only through the `backlog` CLI (`backlog --help`, `backlog task list --plain`, `backlog task edit <id> ...`). Never edit task files by hand. The current milestone is `backlog milestone list`.
