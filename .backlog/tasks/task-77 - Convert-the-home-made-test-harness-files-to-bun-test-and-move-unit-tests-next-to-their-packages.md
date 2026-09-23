---
id: TASK-77
title: >-
  Convert the home-made test harness files to bun:test and move unit tests next
  to their packages
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
  - apps/server/test/providers.js
  - apps/server/test/analytics.js
  - apps/server/test/otlp-export.test.js
priority: high
type: task
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
~9 CommonJS test files copy the same hand-rolled `test()/assert()` counter with coloured ✓/✗ and `process.exit` (e.g. `analytics.js:20-41`). Three of them never run because nothing matches them: `analytics.js`, `otlp-export.test.js`, `otlp-session-extraction.test.js`.

Move and convert (mechanical `assert(x,msg)` → `expect`):
- `providers.js` (731 LOC), `passthrough.js` (459), `stream-formats.test.ts` → `packages/providers/src/*.test.ts`
- `otlp-export.test.js`, `otlp-session-extraction.test.js` → `packages/otlp/src/*.test.ts`
- `analytics.js` → `packages/db/src/analytics.test.ts` (temp DB, never the developer's DB_PATH)
Existing `bun:test` files in apps/server/test keep their names for now.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No test file defines its own test()/assert() helper or calls process.exit; all use bun:test
- [ ] #2 The three previously orphaned files run as part of `bun run test:server` and pass
- [ ] #3 packages/providers, packages/otlp and packages/db each contain colocated *.test.ts and `bun test ./packages` runs them
<!-- AC:END -->
