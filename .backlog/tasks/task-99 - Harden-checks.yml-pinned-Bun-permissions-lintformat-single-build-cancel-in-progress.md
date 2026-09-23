---
id: TASK-99
title: >-
  Harden checks.yml: pinned Bun, permissions, lint+format, single build,
  cancel-in-progress
status: Done
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 12:30'
labels:
  - ci
milestone: m-0
dependencies:
  - TASK-76
  - TASK-87
  - TASK-97
  - TASK-104
references:
  - .github/workflows/checks.yml
  - playwright.config.ts
priority: medium
type: chore
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`.github/workflows/checks.yml` runs install, typecheck, server tests, dashboard vitest, build, test:package (whose prepack builds again), Playwright (whose webServer runs `bun run build` again, `playwright.config.ts:31`) — three builds, each starting with `rm -rf dist`. No `permissions:` block, no Bun version pin, no format/lint step, no concurrency group. After T1/L1/P2 land: one `bun run check` step (typecheck+lint+format), one `bun run test`, one build reused by test:package and Playwright (`reuseExistingServer`/skip build when dist exists), docker build job.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 checks.yml builds exactly once per run, has least-privilege permissions, a pinned Bun version and cancel-in-progress concurrency
- [x] #2 Lint, format check, typecheck, unit/integration tests, dashboard tests, package smoke, Playwright and docker build all run and gate merges
- [x] #3 CI installs with bun ci; workspace scripts run via bun run --filter in dependency order
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged cleanup/task-99 into main (merge 051f5fd). checks.yml: push trigger limited to main (pull_request still covers PR branches; workflow_dispatch added), permissions contents: read, concurrency group per PR/ref with cancel-in-progress, timeout-minutes 30 on both jobs, Bun pinned via bun-version-file .bun-version (1.4.2), install with bun ci, one `bun run check` step (typecheck + lint + format:check), `bun run test` (server bun test --isolate, then dashboard vitest via bun run --filter), a single `bun run build`, then test:package and Playwright, with a playwright-results artifact uploaded on failure. The docker build job (amd64/arm64) runs alongside.
New env var LLMFLOW_REUSE_BUILD=1, handled in apps/server/scripts/build.ts. It makes build (and therefore prepack and the Playwright webServer command `bun run build && ...`) reuse an existing apps/server/dist, and it fails if dist/server.js is missing. CI sets it only on the test:package and Playwright steps. TASK-98 release automation can use it too if it builds once and then packs.
Side effect that already existed before this change: running Playwright locally rewrites PNG screenshots under .backlog/assets/ (design-fixes-2026-09-22/*, images/fixed-*.png). I reverted them and did not commit them. A later task may want to point those screenshot specs at test-results/ instead.
In the task worktree a stray staged change to the TASK-74 backlog file appeared (status In Progress -> To Do). It did not come from this task. I restored it and did not commit it.
Actions are still pinned by major tag (checkout@v4, setup-bun@v2, etc.). SHA pinning was not required by the acceptance criteria.
Merge gate on main: bun install OK; bun run check (typecheck, oxlint, oxfmt --check) OK; bun run test 64 server files pass + dashboard 113/113; bun run build OK; LLMFLOW_REUSE_BUILD=1 bun run test:package OK (reused dist); LLMFLOW_REUSE_BUILD=1 bunx playwright test 125/125. With LLMFLOW_PYTHON=python3 locally the real-Python OTLP test fails only because the opentelemetry module is not installed on this machine; CI pip-installs it first.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:06
---
Workspace decision (2026-09-23): apps/server becomes the published llmflow package and the root goes private (see the "Make apps/server the published llmflow package" task); website leaves the workspaces list. Adjust paths accordingly: dist/ and bin/ live under apps/server.
---

created: 2026-09-23 10:31
---
Scope reminder (2026-09-23): checks.yml only. No npm publish or Docker push here; release automation is TASK-98, which runs last.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened .github/workflows/checks.yml: least-privilege permissions, cancel-in-progress concurrency, Bun pinned via .bun-version, bun ci, a single bun run check step (typecheck+lint+format), bun run test (server + dashboard), exactly one build reused by test:package and Playwright through the new LLMFLOW_REUSE_BUILD=1 switch in apps/server/scripts/build.ts, job timeouts, a Playwright failure artifact, and push limited to main (PRs via pull_request, plus workflow_dispatch). Verified on main with check, test, build, test:package and Playwright (125/125) all green with LLMFLOW_REUSE_BUILD=1.
<!-- SECTION:FINAL_SUMMARY:END -->
