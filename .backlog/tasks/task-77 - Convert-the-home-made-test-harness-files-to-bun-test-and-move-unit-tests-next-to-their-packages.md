---
id: TASK-77
title: >-
  Convert the home-made test harness files to bun:test and move unit tests next
  to their packages
status: Done
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 12:32'
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
- [x] #2 The three previously orphaned files run as part of `bun run test:server` and pass
- [x] #3 packages/providers, packages/otlp and packages/db each contain colocated *.test.ts and `bun test ./packages` runs them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged to main (merge 23302ee). Conflicts: main (TASK-74) had only stripped shebangs from apps/server/test/{analytics,passthrough,providers}.js; this branch deletes them, so the deletions were kept.
Gate on main after merge: bun install, bun run typecheck, lint, format:check all clean; bun run test: server 182 pass / 0 fail (183 tests, 18 files), dashboard 113/113; bun test --isolate ./packages: 127 pass across 7 files.
AC #1 left unchecked: every file this task covered now uses bun:test, but apps/server/test/{otlp-e2e,otlp-logs-e2e,otlp-metrics-e2e,sessions-e2e,websocket-e2e,passthrough-e2e,providers-e2e,demo}.js still have their own test()/assert() helpers and process.exit. Converting them is TASK-78's job.

Verified facts and decisions:
- The package tests that use the database (packages/db/src/analytics.test.ts, packages/otlp/src/session-extraction.test.ts) need `bun test --isolate`, like every server test. Each file sets DATA_DIR/DB_PATH to its own mkdtemp directory before a dynamic `await import(...)`, then calls db.close() and rmSync in afterAll. Without --isolate the @llmflow/db module is shared between files, so the second file finds a closed DB (checked on bun 1.4.2).
- Checked on bun 1.4.2: process 'exit' handlers never fire inside bun test, so cleanup must go in afterAll. A bunfig.toml [test] preload runs once per file under --isolate and once per run without it, but bun only reads bunfig.toml from the cwd, not from parent directories. That is why there is no root preload for the temp DB: it would silently fail to apply when bun test runs from a package directory.
- Checked: bun's expect(value, 'custom message') works on 1.4.2.
- export.test.ts deletes LLMFLOW_OTLP_LEGACY_ATTRS before a dynamic import of ./export, because export.js reads it on import and the test expects current GenAI names only. session-extraction also sets PRICING_URL to an unreachable URL (https://127.0.0.1:1/pricing.json) so importing traces.js does not fetch pricing.
- TASK-85: packages/providers has no tsconfig, so nothing typechecks providers.test.ts or passthrough.test.ts yet. Their parseStream(provider, chunk) helpers and some partial request objects are untyped; they need types once providers is typechecked on its own.
- TASK-78: legacy-scripts.test.ts now lists only otlp-e2e.js, otlp-logs-e2e.js, otlp-metrics-e2e.js, sessions-e2e.js and websocket-e2e.js. Delete it once that list is empty. The root test:server script no longer has the '**/*.test.js' ignore, so any new *.test.js file that calls process.exit would end the whole run.
- TASK-80: packages/shared now has src/redaction.test.ts, which imports sanitizeHeaders from './redaction' (CJS today). It keeps working after the ESM port.
- TASK-81/82/83: the otlp tests import './export' and './traces' as CJS modules from TS. Keep those import paths working, or update them, when porting.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Converted the hand-rolled providers, passthrough, analytics, otlp-export and otlp-session-extraction test scripts to bun:test and moved them next to their packages: packages/providers/src/{providers,passthrough,stream-formats}.test.ts, packages/otlp/src/{export,session-extraction}.test.ts, packages/db/src/analytics.test.ts (it uses a temp DB), and a new packages/shared/src/redaction.test.ts. The three orphaned files now run under bun run test:server. Verified on main: typecheck, lint and format are clean; server tests 182/0 and dashboard tests 113/113 pass; bun test --isolate ./packages passes 127 tests. The remaining *-e2e.js scripts are left for TASK-78.
<!-- SECTION:FINAL_SUMMARY:END -->
