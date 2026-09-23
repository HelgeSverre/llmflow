---
id: TASK-72
title: Fix .env.example and the logger error signature
status: In Progress
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 11:41'
labels:
  - hygiene
  - bug
milestone: m-0
dependencies: []
references:
  - .env.example
  - packages/shared/src/logger.js
  - apps/server/src/server.ts
priority: high
type: bug
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two user-facing bugs from the audit:

1. `.env.example:15` has `DATA_DIR=~/.llmflow`. Bun's `.env` loading and the justfile's `set dotenv-load` do not tilde-expand, so `cp .env.example .env` (as `examples/README.md:20` instructs) makes `packages/db/src/index.ts:8` create a literal `./~/.llmflow` directory. Its comment on `OTLP_EXPORT_ENDPOINT` says it covers all signals; `packages/otlp/src/export.js:21-23` applies it to traces only. It also omits `LLMFLOW_URL`, `PROXY_HOST`/`DASHBOARD_HOST`, `DB_PATH`, `MAX_LOGS`, `MAX_METRICS`, `PROXY_TIMEOUT_MS`, `WS_ALLOWED_ORIGINS`, `PRICING_URL`, `HELICONE_*`, `VITE_*`.
2. `apps/server/src/server.ts:436` and `:1030` call `log.error(msg, error)` but `packages/shared/src/logger.js:54` takes one argument, so a failed replay tells the user to "check the server log" and the log has no cause.

Keep this task small; the full env-var single-source-of-truth lands with the config module task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Copying .env.example to .env and running `bun run dev` creates the data dir under the home directory, not ./~
- [ ] #2 .env.example lists every variable the server reads with a correct one-line comment each
- [ ] #3 log.error accepts an optional error/cause and prints its message and stack; both call sites pass the error
<!-- AC:END -->
