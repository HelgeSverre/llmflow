---
id: TASK-74
title: >-
  Remove Node-era leftovers: wrong shebangs, node-only comments, NODE_ENV, uuid
  alias
status: To Do
assignee: []
created_date: '2026-09-23 08:50'
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
- [ ] #1 grep for '#!/usr/bin/env node' returns only bin/llmflow.js
- [ ] #2 No comment or README instructs running a Bun-only file with node
- [ ] #3 NODE_ENV and the uuidv4 alias are gone; empty apps/server/scripts is removed
<!-- AC:END -->
