---
id: TASK-99
title: >-
  Harden checks.yml: pinned Bun, permissions, lint+format, single build,
  cancel-in-progress
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - ci
milestone: m-0
dependencies:
  - TASK-76
  - TASK-87
  - TASK-97
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
<!-- AC:END -->
