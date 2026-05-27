---
id: TASK-21
title: Cost alerts (threshold-based notifications)
status: To Do
assignee: []
created_date: '2026-05-27 02:24'
labels:
  - feature
dependencies: []
references:
  - packages/pricing/src/index.js
  - apps/server/src/server.ts
  - 'todos.md:146'
modified_files:
  - apps/server/src/server.ts
  - apps/dashboard/src/
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Threshold-based alerts when daily/weekly cost exceeds a configured limit. Listed as Medium priority in Feature Requests. Keeps the 'see what your LLM calls cost' promise from being just a passive display.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Configurable thresholds: daily and weekly cost ceilings, per-provider and/or global
- [ ] #2 Notification channels: webhook (POST to a URL) at minimum; persistent dashboard banner; log line
- [ ] #3 Evaluated on a schedule (every N minutes) and on each insert when over threshold
- [ ] #4 Alert state is debounced so a sustained overage doesn't spam the webhook
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Start simple: env-configured thresholds (LLMFLOW_DAILY_COST_LIMIT, LLMFLOW_WEEKLY_COST_LIMIT, LLMFLOW_ALERT_WEBHOOK). Background interval queries getStats() and fires the webhook when crossing a threshold. Dashboard banner via WS push. Persistent dedup window (e.g., one webhook per 60 min while still over).
<!-- SECTION:PLAN:END -->
