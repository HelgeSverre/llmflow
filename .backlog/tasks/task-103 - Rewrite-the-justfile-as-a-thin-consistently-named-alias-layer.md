---
id: TASK-103
title: 'Rewrite the justfile as a thin, consistently named alias layer'
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 10:31'
labels:
  - justfile
milestone: m-0
dependencies:
  - TASK-102
  - TASK-76
  - TASK-87
references:
  - justfile
  - apps/server/test/recipe-contracts.test.ts
priority: medium
type: chore
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
About 20 recipes are 1:1 aliases of package.json scripts but with hyphen names vs colon scripts, per-file test recipes (`test-otlp`, `test-ws`, …) that disappear with T1, `test-e2e*` calling `bunx playwright` directly instead of the root script, no recipe for dashboard tests or `test:package`, `start:verbose` missing, `status`/`docker`/`format` only in just. Do this last: groups `dev`, `test`, `check`, `build`, `docker`, `website`, `release`, `ops`; every recipe forwards to one root script or one scripts/*.ts; `test *args` passes filters through; `check` = typecheck+lint+format+test; `apps/server/test/recipe-contracts.test.ts` dry-runs every recipe and must keep passing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every recipe has a one-line comment, belongs to a group, and forwards to a root script or scripts/*.ts (no inline shell longer than one line except status/clean)
- [ ] #2 `just --list` output is what README documents; recipe-contracts test passes
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Reconciled with TASK-104: recipes may forward to root scripts, root scripts/*.ts, or workspace scripts via bun run --filter <pkg> <script>; never to a relative path into a workspace.
---

created: 2026-09-23 10:31
---
Decision (2026-09-23): the release recipe is added by TASK-98, which now runs after this task; do not block on it.
---
<!-- COMMENTS:END -->
