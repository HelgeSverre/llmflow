---
id: TASK-93
title: Deduplicate DB queries and keep a single migration mechanism
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - refactor
  - db
milestone: m-0
dependencies:
  - TASK-88
references:
  - packages/db/src/index.ts
  - packages/db/src/migrations.ts
priority: medium
type: task
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`packages/db/src/index.ts`: five "distinct values" helpers (:694, :908, :918, :1130, :1138); `getModelStats` (:1336) and `getCostByModel` (:1254) run the same GROUP BY with different aliases; two migration systems coexist (`ensureColumn` :42-47/:82-92 and the versioned `migrations.ts`). Server-side JSON-column parsing is done separately in `/api/traces/:id` (453-486) and `/tree` (503-515); the `if (get(x)) filters.x = …` pattern repeats in 409-426, 598-604, 679-688, 717-722 (move into the api split if that lands first).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One generic distinct-values helper, one model aggregate query, one migration mechanism (versioned) with existing DBs upgrading cleanly (test with a v0.4.1-shaped DB)
- [ ] #2 Row JSON-column parsing is one function used by every trace endpoint
<!-- AC:END -->
