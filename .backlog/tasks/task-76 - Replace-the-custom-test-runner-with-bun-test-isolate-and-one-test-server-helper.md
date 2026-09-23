---
id: TASK-76
title: >-
  Replace the custom test runner with bun test --isolate and one test-server
  helper
status: In Progress
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 11:59'
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
- [ ] #1 `bun run test` runs the server, package and dashboard suites and exits non-zero on any failure; run-tests.js is deleted
- [ ] #2 Every server test that needs a server gets it from test/helpers/test-server.ts on port 0 with its own temp DB; no test hardcodes 1337/8080
- [ ] #3 `bun run test:live` with no API keys exits 0 with every live test skipped
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Automated cleanup run: blocked — The user only asked to gitignore the worktrees folder, and main already does that. The computed task asks for a much larger test-runner rewrite (TASK-76) that the user did not request. Implementing it needs the user to confirm the workflow should run TASK-76.. Partial work on branch cleanup/task-76.
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
