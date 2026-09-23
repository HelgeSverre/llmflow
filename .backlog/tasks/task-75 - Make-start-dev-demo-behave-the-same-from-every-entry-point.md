---
id: TASK-75
title: Make start/dev/demo behave the same from every entry point
status: To Do
assignee: []
created_date: '2026-09-23 08:50'
labels:
  - runtime
  - scripts
milestone: m-0
dependencies: []
references:
  - bin/llmflow.js
  - package.json
  - apps/server/package.json
  - justfile
priority: medium
type: bug
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- `bin/llmflow.js:41` uses `dist/server.js` whenever it exists, so `bun run start` in a checkout runs the last build, not the source (a stale `dist/` is present right now). `apps/server/package.json:8` `start` runs the source instead: two "start" commands with different behaviour.
- `package.json:17` `start` is `bun bin/llmflow.js`: Bun runs a Node launcher that spawns a second Bun.
- `dev`, `dev:server`, `dev:dashboard`, `demo`, `demo:many` exist in the root, in `apps/server/package.json:9-11`, in `apps/dashboard/package.json:7` and in the justfile; all end in `scripts/dev.ts`.
- `just clean` removes only the root `node_modules`, not workspace ones nor `dist/`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In a checkout, `bun run start` runs current source; an npm install runs dist/server.js (test:package still passes)
- [ ] #2 Each of start/dev/demo is defined once (root package.json); workspace package.json files keep only workspace-local scripts
- [ ] #3 `just clean` removes dist/, apps/dashboard/dist and every node_modules
<!-- AC:END -->
