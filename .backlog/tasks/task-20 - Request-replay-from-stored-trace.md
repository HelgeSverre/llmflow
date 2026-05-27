---
id: TASK-20
title: Request replay from stored trace
status: To Do
assignee: []
created_date: '2026-05-27 02:24'
labels:
  - feature
dependencies:
  - TASK-8
references:
  - apps/server/src/server.ts
  - apps/dashboard/src/
  - packages/db/src/index.ts
  - 'todos.md:145'
modified_files:
  - apps/server/src/server.ts
  - apps/dashboard/src/
  - packages/db/src/index.ts
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From any stored trace, replay the original request to the upstream provider and capture the new response next to the old for side-by-side comparison. Listed as Medium priority in Feature Requests. Useful for prompt-regression debugging.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dashboard adds a Replay button on the trace detail view
- [ ] #2 POST /api/traces/:id/replay re-fires the original request and stores the new trace with a replay_of column pointing at the original id
- [ ] #3 Replay strips the stored Authorization header and re-injects credentials from env vars — stored bearer tokens are NEVER reused
- [ ] #4 Dashboard renders a side-by-side diff of old vs replayed response
- [ ] #5 Streaming replays work too (use the same proxy code path)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Backend endpoint reads the stored trace, strips Authorization, re-injects from env (OPENAI_API_KEY etc.), feeds the request through the existing proxy handler so usage/cost calc stays uniform, then inserts a new trace row with replay_of=<original_id>. UI: button + a simple two-column diff view (use diff-match-patch or @opensource/diff for JSON diff). Add replay_of column via the new migrations runner.
<!-- SECTION:PLAN:END -->
