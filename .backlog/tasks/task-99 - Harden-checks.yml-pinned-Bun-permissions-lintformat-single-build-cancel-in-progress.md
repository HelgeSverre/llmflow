---
id: TASK-99
title: >-
  Harden checks.yml: pinned Bun, permissions, lint+format, single build,
  cancel-in-progress
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 10:31'
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
- [ ] #1 checks.yml builds exactly once per run, has least-privilege permissions, a pinned Bun version and cancel-in-progress concurrency
- [ ] #2 Lint, format check, typecheck, unit/integration tests, dashboard tests, package smoke, Playwright and docker build all run and gate merges
- [ ] #3 CI installs with bun ci; workspace scripts run via bun run --filter in dependency order
<!-- AC:END -->

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
