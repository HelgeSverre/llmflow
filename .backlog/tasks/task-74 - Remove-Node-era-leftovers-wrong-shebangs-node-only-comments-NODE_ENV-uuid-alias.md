---
id: TASK-74
title: >-
  Remove Node-era leftovers: wrong shebangs, node-only comments, NODE_ENV, uuid
  alias
status: Done
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 12:27'
labels:
  - runtime
  - dead-code
milestone: m-0
dependencies: []
references:
  - apps/server/test
  - e2e/playwright/start-test-server.js
priority: medium
type: chore
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Files that only run on Bun still claim to be Node scripts:
- 11 files in `apps/server/test/*.js` have `#!/usr/bin/env node` and `Run: node test/...` headers (e.g. `otlp-e2e.js:12`, `websocket-e2e.js:13`); they use `require` inside a `type: module` package, Bun's built-in `ws`, and `bun:sqlite`.
- `e2e/playwright/start-test-server.js:1` says node but uses `Bun.serve` (:19).
- `examples/observability/README.md:41` says `node test.js`; no such file exists.
- `NODE_ENV` is set in `docker/Dockerfile:12`, `run-tests.js:40`, `start-test-server.js:13` and read nowhere.
- `const uuidv4 = () => crypto.randomUUID()` in `packages/otlp/src/logs.js:13` and `metrics.js:13`.
- `apps/server/scripts/` is now an empty directory.
Note: the `http`/`https` clients in otlp/export.js and pricing/index.js are replaced by fetch in the TypeScript port tasks, not here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 grep for '#!/usr/bin/env node' returns only bin/llmflow.js
- [x] #2 No comment or README instructs running a Bun-only file with node
- [x] #3 NODE_ENV and the uuidv4 alias are gone
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- run-tests.js, which the task description mentions, was already removed by TASK-76. The last NODE_ENV was in the TASK-76 helper `isolatedEnv` (apps/server/test/helpers/test-server.ts); it has been removed.
- The observability README had a table column saying every backend had a script (all ticked). No such scripts exist, so I removed the column. Step 4 now points to examples/rag-pipeline (`bun run start`) to generate traffic.
- The legacy test headers now point at legacy-scripts.test.ts, matching the existing sessions-e2e.js header. TASK-77 and TASK-78 will rewrite these when they convert the scripts.
- apps/server/scripts (build.ts, dev.ts) was kept, per the task comment about TASK-104.
- Warning for the merge step and other workers: running Playwright in a worktree rewrites the committed .backlog/assets/*.png screenshots. My first commit picked them up by accident through `git add -A`. I amended it, and the final commit contains only the 18 intended files. Other workers should stage specific files after running Playwright.
- Merge verification on main: git grep '#!/usr/bin/env node' matches only apps/server/bin/llmflow.js (outside .backlog); no NODE_ENV or uuidv4 left; no 'node <file>' run instructions left. bun install, typecheck, lint, format:check, test:server (64 pass, 1 skip), test:dashboard (113 pass) and Playwright (125 pass) all green. Playwright-rewritten .backlog/assets screenshots were restored, not committed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Reconciled with TASK-104: apps/server/scripts is reused for server dev/build/demo scripts, so do not delete the directory.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed Node-era leftovers: node shebangs and 'Run: node' headers from the Bun-only apps/server/test scripts and e2e/playwright/start-test-server.js, NODE_ENV from docker/Dockerfile, start-test-server.js and the isolatedEnv test helper, the uuidv4 alias in packages/otlp logs.js/metrics.js, and the nonexistent 'node test.js' and per-backend script claims in examples/observability/README.md. apps/server/scripts was kept for TASK-104. Verified on main with grep checks plus typecheck, lint, format check, server/dashboard unit tests and Playwright, all green.
<!-- SECTION:FINAL_SUMMARY:END -->
