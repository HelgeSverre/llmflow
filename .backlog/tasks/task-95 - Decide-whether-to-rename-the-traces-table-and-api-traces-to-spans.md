---
id: TASK-95
title: Decide whether to rename the traces table and /api/traces to spans
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - naming
  - db
milestone: m-0
dependencies:
  - TASK-94
references:
  - packages/db/src/index.ts
priority: low
type: spike
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `traces` table stores spans; `/api/traces` returns spans and `:id` is a span id; `MAX_TRACES` counts span rows; `/health` reports `traces` as a span count (`server.ts:927`); `POST /api/spans` writes into `traces`. Renaming touches the schema (migration), every query, the dashboard stores and the SDK. Time-box: write up cost/benefit and either do it as its own task or record "won't fix" in ARCHITECTURE.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A written decision exists in the task notes and ARCHITECTURE.md; if 'rename', a follow-up task with migration plan is created
<!-- AC:END -->
