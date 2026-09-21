---
id: TASK-38
title: Repair Analytics response contracts and render real totals
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:48'
labels:
  - bug
  - dashboard
dependencies: []
references:
  - apps/dashboard/src/lib/components/analytics/AnalyticsTab.svelte
  - apps/dashboard/src/lib/stores/analytics.svelte.ts
  - apps/server/src/server.ts
  - packages/db/src/index.ts
  - e2e/playwright/analytics.spec.js
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: high
ordinal: 700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two connected API/UI mismatches break the Analytics screen: cost-by-tool rows lack the tool field dereferenced by the UI, and daily rows use tokens/cost/requests where the UI expects total_tokens/total_cost/request_count plus prompt_tokens. Chromium reproduces a toLowerCase render error and empty/invalid charts with nonzero data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Analytics renders cost-by-tool rows from real stored data without page errors, using an explicitly defined display/grouping field.
- [x] #2 Daily table and token chart show exact seeded requests, tokens and cost; the prompt series has a real matching aggregate or is removed.
- [x] #3 Empty and nonempty periods render correctly; a browser regression asserts labels and numeric values rather than only section existence.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Align daily and cost-by-service analytics response fields with the UI, including prompt tokens; verify actual table/chart values in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 2. Broken screens and navigation; overall position 7. See doc-4. This is scheduling order, not an artificial implementation dependency.

Analytics now renders real daily requests, prompt/completion/total tokens and costs, and groups service costs using the fields returned by the API. Removed the undefined tool-name dereference. Browser regression verifies nonzero seeded data, labels, chart bars and no page errors.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Analytics now renders real daily requests, prompt/completion/total tokens and costs, and groups service costs using the fields returned by the API. Removed the undefined tool-name dereference. Browser regression verifies nonzero seeded data, labels, chart bars and no page errors.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
