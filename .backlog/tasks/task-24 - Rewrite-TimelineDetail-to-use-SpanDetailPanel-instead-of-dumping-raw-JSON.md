---
id: TASK-24
title: Make timeline trace and log details readable
status: Done
assignee:
  - '@codex'
created_date: '2026-05-27 15:59'
updated_date: '2026-09-21 11:48'
labels:
  - dashboard
  - timeline
  - ux
dependencies: []
references:
  - apps/dashboard/src/lib/components/timeline/TimelineDetail.svelte
  - apps/dashboard/src/lib/components/trace-viewer/SpanDetailPanel.svelte
  - apps/dashboard/src/lib/trace/tree.ts
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 1800
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Timeline detail remains a raw JSON presentation for trace and log items. Viewport overflow is already fixed; the remaining work is structured, readable detail content. /api/timeline supplies traces and logs only, so metric-detail requirements do not belong in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Trace items render structured header, KPIs and attributes through SpanDetailPanel or an equivalent presentation.
- [x] #2 Log items render severity, body, attributes and a working trace link when present.
- [x] #3 The detail panel avoids a full-record JSON dump and keeps long content scrolling within the bounded body.
- [x] #4 Timeline rows remain readable without obsolete global layout styles squeezing titles into columns.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the approved doc-4 scope using existing API and detail components; add focused browser regressions and verify typecheck.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Removed unreachable metric scope and the stale claim that timeline JSON currently breaks page containment. Structured presentation remains unimplemented.

Execution sequence: 5. Readable trace inspection; overall position 18. See doc-4. This is scheduling order, not an artificial implementation dependency.

Timeline uses structured span detail with KPIs and attributes, readable log sections and working trace links instead of a full-record JSON dump. Removed obsolete global Timeline CSS that squeezed row titles into columns. Browser and screenshot checks verify bounded scrolling and readable rows.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Timeline uses structured span detail with KPIs and attributes, readable log sections and working trace links instead of a full-record JSON dump. Removed obsolete global Timeline CSS that squeezed row titles into columns. Browser and screenshot checks verify bounded scrolling and readable rows.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
