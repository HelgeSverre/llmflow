---
id: TASK-8
title: Real migrations runner with version-stamped steps
status: To Do
assignee: []
created_date: '2026-05-27 02:22'
labels:
  - refactor
  - p2
dependencies: []
references:
  - packages/db/src/index.ts
  - 'todos.md:106'
modified_files:
  - packages/db/src/index.ts
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace ensureColumn with a schema_version table and version-stamped migration steps. The current scheme handles ADD COLUMN only — any rename, FTS5 backfill, or index swap will break it. Required dependency for FTS5 (task-5) and the body-cap migration (task-4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 schema_version table created if missing
- [ ] #2 Migrations registered as ordered { id, name, up(db) } steps
- [ ] #3 Up-only; idempotent on restart
- [ ] #4 Existing ensureColumn calls migrated into step 1 (current schema as of writing)
- [ ] #5 New migrations are testable by booting against an empty DB and verifying the schema
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Define type Migration = { id: number; name: string; up: (db: Database) => void }. On boot read max(version) from schema_version, run each migration where id > max in a transaction, then insert the new version row. Step 1 = the schema currently produced by initSchema. Subsequent steps are added by feature work.
<!-- SECTION:PLAN:END -->
