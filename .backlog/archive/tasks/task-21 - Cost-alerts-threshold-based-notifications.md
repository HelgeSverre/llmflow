---
id: TASK-21
title: Cost alerts (threshold-based notifications)
status: To Do
assignee: []
created_date: '2026-05-27 02:24'
updated_date: '2026-09-21 09:53'
labels:
  - feature
dependencies: []
references:
  - apps/dashboard/src/lib/stores/stats.svelte.ts
  - packages/pricing/src/index.js
  - packages/db/src/index.ts
modified_files:
  - apps/server/src/server.ts
  - apps/dashboard/src/
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Configurable cost threshold alerts remain unimplemented. The pricing freshness warning is a separate feature and does not implement spend threshold notifications. Environment names in this proposal are planned settings, not currently supported runtime options.
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
Define documented threshold settings, period-specific daily/weekly spend queries and notification channels. Evaluate on a bounded schedule and threshold crossing; persist deduplication state and push banner changes over WebSocket. Test period boundaries and restart behavior. Proposed environment settings are not supported until implemented.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Kept open; distinguished pricing-source freshness from cost threshold alerts.

2026-09-21 product-scope pruning: Budget webhooks, schedules, persisted deduplication and alert banners expand a local debugging tool into a monitoring product. Captured local traffic is not necessarily complete account spend; drop this speculative feature.
<!-- SECTION:NOTES:END -->
