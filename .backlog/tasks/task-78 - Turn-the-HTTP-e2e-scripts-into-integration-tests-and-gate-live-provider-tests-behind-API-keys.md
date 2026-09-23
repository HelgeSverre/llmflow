---
id: TASK-78
title: >-
  Turn the HTTP e2e scripts into integration tests and gate live-provider tests
  behind API keys
status: To Do
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 08:52'
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
- [ ] #1 apps/server/test contains only *.test.ts files plus helpers/ fixtures/ live/; no *-e2e.js remain
- [ ] #2 `bun run test:server` runs each former e2e scenario exactly once against an in-process server
- [ ] #3 live/ tests are skipped without keys and run the matching provider when its key is set
<!-- AC:END -->
