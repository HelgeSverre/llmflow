---
id: TASK-76
title: >-
  Replace the custom test runner with bun test --isolate and one test-server
  helper
status: Done
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 12:14'
labels:
  - tests
milestone: m-0
dependencies: []
references:
  - apps/server/test/run-tests.js
  - apps/server/test/contract-fixes.test.ts
  - package.json
priority: high
type: task
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision: bun test for apps/server + packages/*, Vitest stays for apps/dashboard, Playwright stays in e2e/.

`apps/server/test/run-tests.js` exists only to give each file a fresh process and a shared server on free ports; Bun 1.4 `bun test --isolate` (fresh global per file) makes it redundant. Three ways of starting an isolated server exist today (`run-tests.js`, `e2e/playwright/start-test-server.js`, ad-hoc code in each `.test.ts`); `contract-fixes.test.ts:1-25` has the pattern to lift into a helper.

Scope:
- `apps/server/test/helpers/test-server.ts`: `startTestServer()` → temp DATA_DIR/DB_PATH, DASHBOARD_PORT=0, unreachable PRICING_URL, export off, calls `startDashboardServer()` (+ `startProxyServer(0)` on demand) from `apps/server/src/server.ts`; returns `{ url, proxyUrl, db, stop }`. Keep `freePort`/`runChild` for the subprocess tests (shutdown, sdk-endpoint, dev-startup).
- Root scripts: `test` = server + dashboard; `test:server` = `bun test --isolate --path-ignore-patterns='**/live/**' ./apps/server ./packages`; `test:dashboard`; `test:live`. Drop `test:otlp|ws|logs|metrics|providers|providers-e2e` (use `bun test <filter>`).
- Delete `run-tests.js`; move `test/lib/otlp-builders.js` → `test/helpers/`; `python-otlp.py` → `test/fixtures/` (update `telemetry-regressions.test.ts:293`).
- CI runs `bun run test` once instead of two separate steps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `bun run test` runs the server, package and dashboard suites and exits non-zero on any failure; run-tests.js is deleted
- [x] #2 Every server test that needs a server gets it from test/helpers/test-server.ts on port 0 with its own temp DB; no test hardcodes 1337/8080
- [x] #3 `bun run test:live` with no API keys exits 0 with every live test skipped
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Automated cleanup run: blocked — The user only asked to gitignore the worktrees folder, and main already does that. The computed task asks for a much larger test-runner rewrite (TASK-76) that the user did not request. Implementing it needs the user to confirm the workflow should run TASK-76.. Partial work on branch cleanup/task-76.

Merged cleanup/task-76 into main (no conflicts). Gate on main: bun install, typecheck, lint, format:check, bun run test (server 64 pass/1 skip/0 fail across 12 files; dashboard 14 files/113 tests pass), Playwright 125 passed. AC#3 verified with env -i and an empty --env-file: test:live -> 0 pass, 2 skip, 0 fail. AC#2: the legacy scripts under test/*.js still fall back to 1337/8080 when run by hand, but every test run hands them helper URLs through LLMFLOW_URL/PROXY_URL.

Handoff facts and decisions:
- TASK-77: legacy-scripts.test.ts runs these scripts as child processes: otlp-e2e.js, otlp-export.test.js, otlp-logs-e2e.js, otlp-metrics-e2e.js, otlp-session-extraction.test.js, passthrough.js, providers.js, sessions-e2e.js and websocket-e2e.js. When you convert a script to bun:test, remove it from that list. Delete legacy-scripts.test.ts once the list is empty.
- TASK-77: the root test:server script has a temporary --path-ignore-patterns='**/*.test.js', because the two old *.test.js files call process.exit, which would end the whole bun test run. Remove that flag once they are converted.
- TASK-78: live/providers.test.ts is a file-level wrapper that skips when no provider key is set. Replace it with a skipIf per provider. reviewed-fixes.test.ts still starts otlp-e2e.js as a child process, so that suite runs twice (as before); deleting that spawn is TASK-78's job.
- Verified: repeating --path-ignore-patterns works in bun 1.4.2. The third argument to test.skipIf(cond)(name, fn, timeout) sets the timeout. bun test loads the developer's .env and shell environment, so test:live makes real, paid calls whenever keys are set.
- Server modules read their configuration when first imported. So call startTestServer once per file, and call mock.module before it; reviewed-fixes does this for pricing. env: { KEY: undefined } deletes a variable. The helper's stop() closes the database and removes the temporary directory.
- e2e/playwright/start-test-server.js was not changed. It runs under Node, so it cannot import the TypeScript helper.
- Something in the workflow had staged a status change to the TASK-76 backlog file in this worktree. I reverted it rather than commit it.
- TASK-103: the justfile test recipes are now test, test-server, test-dashboard and test-live.
- TASK-99: CI now runs bun run test once, and that includes the dashboard.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Note: bun test also matches *.spec.* files, so always pass explicit paths (./apps/server ./packages) so Playwright specs under e2e/ and the dashboard vitest files are never picked up.
---

created: 2026-09-23 09:24
---
Verified 2026-09-23 (bun.com/docs/test/discovery): bun test positional arguments are substring path filters, not globs, and a leading ./ or / means an exact file path. So the script must be bun test --isolate --path-ignore-patterns "**/live/**" apps/server packages (no ./ prefix). Default discovery matches *.test.*, *_test.*, *.spec.*, *_spec.*.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced apps/server/test/run-tests.js with bun test --isolate plus a shared apps/server/test/helpers/test-server.ts (startTestServer on port 0 with a temp DB; stop() closes the DB and removes the temp dir). Root scripts are now test (server + dashboard), test:server, test:dashboard and test:live. The old scripts run through legacy-scripts.test.ts until TASK-77/78 convert them. Live provider tests skip when no keys are set. CI runs bun run test once. Verified on main: typecheck, lint and format pass; bun run test is green (server 64 pass/1 skip, dashboard 113 pass); Playwright 125 pass; test:live with no keys gives 2 skip, 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
