---
id: TASK-78
title: >-
  Turn the HTTP e2e scripts into integration tests and gate live-provider tests
  behind API keys
status: Done
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 12:36'
labels:
  - tests
milestone: m-0
dependencies:
  - TASK-76
references:
  - apps/server/test/otlp-e2e.js
  - apps/server/test/providers-e2e.js
  - apps/server/test/demo.js
priority: high
type: task
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- Convert with `startTestServer()`: `otlp-e2e.js`→`otlp-traces.test.ts`, `otlp-logs-e2e.js`→`otlp-logs.test.ts`, `otlp-metrics-e2e.js`→`otlp-metrics.test.ts`, `websocket-e2e.js`→`websocket.test.ts` (use Bun's global WebSocket; `require('ws')` is undeclared), `sessions-e2e.js`→`sessions.test.ts`.
- `otlp-e2e.js` currently runs twice per `bun run test` (directly and spawned at `reviewed-fixes.test.ts:45`): delete the spawn.
- `providers-e2e.js` (521 LOC) and `passthrough-e2e.js` (423, has no script at all) hit real providers: move to `apps/server/test/live/` with `test.skipIf(!process.env.X_API_KEY)` per provider; keep `lib/live-providers.js` model overrides.
- `demo.js` (1072 LOC) is a traffic generator, not a test: move to `scripts/demo.ts` and update `scripts/dev.ts:27` and the `demo` scripts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 apps/server/test contains only *.test.ts files plus helpers/ fixtures/ live/; no *-e2e.js remain
- [x] #2 `bun run test:server` runs each former e2e scenario exactly once against an in-process server
- [x] #3 live/ tests are skipped without keys and run the matching provider when its key is set
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged by the workflow (7d137bc); finalized manually after the workflow was stopped. Verified on main: apps/server/test has only *.test.ts + helpers/ fixtures/ live/; demo.js -> apps/server/scripts/demo.ts; bun run check green; bun run test: server 208 pass/1 skip/0 fail, dashboard 113 pass. test:live with an empty env file: 18 skip. With the local .env keys: OpenAI/Anthropic/Mistral pass; Gemini fails with HTTP 402 (account prepayment credits depleted) — account issue, not code. Note: Bun auto-loads .env, so 'unset KEY' is not enough to skip live tests; use --env-file with an empty file.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Reconciled with TASK-104: demo.js moves to apps/server/scripts/demo.ts (not root scripts/), so it can import server and package code without crossing workspaces.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Converted the OTLP/WebSocket/sessions e2e scripts into in-process bun:test integration tests, moved real-provider tests to apps/server/test/live/ gated per provider key, moved the demo traffic generator to apps/server/scripts/demo.ts. Verified with bun run check, bun run test and test:live with and without keys.
<!-- SECTION:FINAL_SUMMARY:END -->
