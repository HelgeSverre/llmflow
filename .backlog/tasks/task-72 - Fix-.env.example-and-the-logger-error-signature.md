---
id: TASK-72
title: Fix .env.example and the logger error signature
status: Done
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 11:59'
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
- [x] #1 Copying .env.example to .env and running `bun run dev` creates the data dir under the home directory, not ./~
- [x] #2 .env.example lists every variable the server reads with a correct one-line comment each
- [x] #3 log.error accepts an optional error/cause and prints its message and stack; both call sites pass the error
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged cleanup/task-72 into main (no conflicts). Gate on main after merge: bun install, bun run typecheck, lint, format:check, bun run test (14 passed), dashboard vitest (113 passed), and bun test apps/server/test/env-and-logger.test.ts (3 passed) all green.
Decisions and facts:
- The relayed user request ("gitignore worktres folder") was already satisfied on main by commit 4b16d56; .claude/worktrees/ is in .gitignore (currently line 14). Nothing further needed.
- log.error still writes to stdout (console.log), not stderr. Kept on purpose to limit scope; the config-module task can move it to stderr.
- Provider API keys in the server are read only by the dashboard provider health check (server.ts around lines 230-330) and by replay (replay.ts credential table). Proxied requests use the key the client sends.
- LLMFLOW_URL is read only by packages/dev-runtime backendUrl(), used by the dashboard dev server and bun run demo. The e2e runner also sets it.
- apps/server/test/env-and-logger.test.ts fails whenever source reads a new process.env.X that .env.example does not list. The config-module task (single source of truth) should replace this check or keep it in line.
- expandHome in packages/db/src/index.ts is local to that file; the config-module task should move it into the shared config module.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed .env.example (DATA_DIR no longer a literal ~ path; documented every env var the server and dev tooling read with correct one-line comments, incl. OTLP_EXPORT_ENDPOINT being traces-only), added tilde expansion for DATA_DIR/DB_PATH in packages/db, and made log.error accept an optional cause that prints the error stack; both server.ts call sites pass the error. Verified by apps/server/test/env-and-logger.test.ts (env coverage, ~ resolves under HOME not ./~, log.error cause output) plus the full gate on main.
<!-- SECTION:FINAL_SUMMARY:END -->
