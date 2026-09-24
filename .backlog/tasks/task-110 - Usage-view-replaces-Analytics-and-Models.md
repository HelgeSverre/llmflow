---
id: TASK-110
title: Usage view replaces Analytics and Models
status: To Do
assignee: []
created_date: '2026-09-24 01:32'
updated_date: '2026-09-24 01:32'
labels:
  - vocabulary
  - ready-for-agent
milestone: m-1
dependencies:
  - TASK-109
references:
  - CONTEXT.md
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Models and Analytics tabs overlap (Analytics has its own Cost by Model section); CONTEXT.md merges them into one Usage view: span count, tokens and cost by model, by service and over time. Models currently uses ModelAggregate/ModelStats/ModelCost for the same per-model row.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One Usage tab replaces Analytics and Models, with breakdowns by model, by service and over time
- [ ] #2 Old #analytics and #models links open the Usage tab
- [ ] #3 The per-model aggregate has one type name across db, API and dashboard
- [ ] #4 E2E specs cover the Usage tab
<!-- AC:END -->
