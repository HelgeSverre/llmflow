---
id: TASK-103
title: 'Rewrite the justfile as a thin, consistently named alias layer'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 19:49'
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
- [x] #1 Every recipe has a one-line comment, belongs to a group, and forwards to a root script or scripts/*.ts (no inline shell longer than one line except status/clean)
- [x] #2 `just --list` output is what README documents; recipe-contracts test passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rewrite justfile: one comment and group per recipe, each forwarding to one root script or scripts/*.ts. 2. Add missing aliases (start, start-verbose, test-package, env-docs, pricing-refresh), e2e via root scripts, test *args filter, check = check + test. 3. Verify just --list, filtered test, recipe-contracts; align README/AGENTS.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts:
- Groups: dev (dev, dev-server, dev-dashboard, demo, demo-many, start, start-verbose), test (test *args, test-server, test-dashboard, test-live, test-e2e, test-e2e-headed, test-e2e-ui, test-package), check (check, typecheck, lint, lint-fix, format, format-check), build (build, env-docs, pricing-refresh), docker (docker -> scripts/docker-dev.ts, docker-stop, docker-logs), ops (status, clean), website (website, website-og, website-preview, website-deploy -> bun run --cwd website, which is outside the workspaces). The release group is added by TASK-98.
- Only status and clean have multi-line bodies; every other recipe is one line forwarding to a root script, scripts/*.ts or the website's own scripts. Recipe names are the script names with '-' for ':'.
- just test <path> runs 'bun test --isolate --path-ignore-patterns=**/live/** <path>' (checked: just test proxy-cors -> 2 pass); bare 'just test' = bun run test. just check = bun run check && bun run test (per the task), so it differs from bun run check; README and AGENTS say so.
- clean now also removes packages/sdk/dist.
- README 'just --list' sentence and AGENTS command line match the recipe list.
Validation: just --list (output above); apps/server/test/recipe-contracts.test.ts 2 pass (dry-runs every recipe, clean honours an isolated DB_PATH); bun run check green.
<!-- SECTION:NOTES:END -->

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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rewrote the justfile as a thin alias layer: every recipe has a comment and group and forwards to one root script or scripts/*.ts; added the missing aliases, made test filterable and check include tests, and aligned README/AGENTS. Verified with just --list, a filtered just test run, the recipe-contracts test and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
