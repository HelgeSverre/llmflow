---
id: TASK-8
title: Real migrations runner with version-stamped steps
status: In Progress
assignee: []
created_date: '2026-05-27 02:22'
updated_date: '2026-09-21 09:53'
labels:
  - refactor
  - p2
dependencies: []
references:
  - packages/db/src/migrations.ts
  - packages/db/src/index.ts
  - apps/server/test/database-regressions.test.ts
modified_files:
  - packages/db/src/index.ts
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A transactional up-only runner and schema_migrations ledger now exist. Retention-related migrations are versioned, but legacy ensureColumn bootstrap remains outside the runner and migrations still lack explicit named IDs. Finish the migration structure without changing the meaning of already applied versions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 schema_migrations ledger is created when missing.
- [ ] #2 Migrations are registered as ordered explicit { id, name, up(db) } steps.
- [x] #3 Migrations are up-only and idempotent on restart.
- [ ] #4 Legacy ensureColumn bootstrap is incorporated into versioned schema setup without renumbering or replaying applied migrations.
- [ ] #5 Fresh-database tests verify the complete expected schema, alongside legacy upgrade tests.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Preserve applied versions 1–3. Introduce explicit stable IDs/names for registered steps and migrate legacy bootstrap safely for fresh and existing databases. Verify complete schema, legacy upgrade, idempotent restart and rollback on migration failure.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Ledger and restart behavior are implemented; named registration, legacy bootstrap integration and complete fresh-schema assertions remain open. Removed the inaccurate claim that body capture limits require this migration work.

2026-09-21 product-scope pruning: The versioned transactional runner already works. Named step objects and moving existing bootstrap code do not solve a demonstrated upgrade failure. Fix specific migration failures if reproduced, rather than reorganizing for symmetry.
<!-- SECTION:NOTES:END -->
