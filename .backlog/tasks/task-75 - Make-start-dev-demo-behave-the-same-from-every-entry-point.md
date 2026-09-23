---
id: TASK-75
title: Make start/dev/demo behave the same from every entry point
status: Done
assignee: []
created_date: '2026-09-23 08:50'
updated_date: '2026-09-23 11:37'
labels:
  - runtime
  - scripts
milestone: m-0
dependencies:
  - TASK-104
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
- [x] #1 In a checkout, `bun run start` runs current source; an npm install runs dist/server.js (test:package still passes)
- [x] #2 Each of start/dev/demo is defined once (root package.json); workspace package.json files keep only workspace-local scripts
- [x] #3 `just clean` removes dist/, apps/dashboard/dist and every node_modules
- [x] #4 Root start/dev/demo scripts forward to apps/server scripts via bun run --filter; no relative ../ import across workspaces
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
apps/server `start` is now `bun src/server.ts` and `start:verbose` is `bun src/server.ts --verbose`; --verbose works because packages/shared/logger and packages/pricing read process.argv.
In source mode the server serves apps/dashboard/dist, so the dashboard UI needs `bun run build` first; examples already say `bun run build && bun run start`.
bin/llmflow.js now picks `existsSync(src/server.ts) ? source : dist/server.js`; the missing-artifact message is just "Reinstall llmflow."
`just clean` uses `find . \( -path ./.git -o -path ./.claude \) -prune -o -type d -name node_modules -prune -exec rm -rf {} +`; the .claude prune keeps it from deleting node_modules in agent worktrees under .claude/worktrees. It also removes dist, apps/server/dist and apps/dashboard/dist.
`just clean` still deletes the default ~/.llmflow/data.db; set DB_PATH when testing it.
The justfile still repeats the dev/demo recipes as thin aliases; TASK-103 owns the justfile rewrite.
README paragraph on bin/start updated; TASK-102 will rewrite the README anyway. website/llms.txt still reads correctly.
Validation on main after merge: bun install, bun run typecheck, bun run test, dashboard vitest (113 passed), lint, format:check, test:package all green; `bun run start` smoke-tested (spawned `bun src/server.ts`).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:06
---
Workspace decision (2026-09-23): apps/server becomes the published llmflow package and the root goes private (see the "Make apps/server the published llmflow package" task); website leaves the workspaces list. Adjust paths accordingly: dist/ and bin/ live under apps/server.
---

created: 2026-09-23 09:15
---
See TASK-104 clarification (2): dev runs server and dashboard as two workspace scripts orchestrated from the root via bun run --filter; port discovery stays file/env based.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Root start/dev/demo forward to apps/server scripts via bun run --filter; apps/server start runs src/server.ts directly; bin/llmflow.js prefers src over a stale dist in a checkout while npm installs run dist/server.js; just clean removes every node_modules (skipping .git and .claude) plus all dist dirs. Verified with typecheck, server tests, dashboard tests, lint, format check, test:package and a bun run start smoke test.
<!-- SECTION:FINAL_SUMMARY:END -->
