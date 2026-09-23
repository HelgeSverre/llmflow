---
id: TASK-79
title: Add dashboard unit tests for the pure logic modules
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
labels:
  - tests
  - dashboard
milestone: m-0
dependencies: []
references:
  - apps/dashboard/src/lib/utils/format.ts
  - apps/dashboard/src/lib/trace/tree.ts
priority: low
type: task
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The dashboard has 8 Vitest files (stores, waterfall, debounce) but none for the pure helpers that every view depends on: `lib/utils/format.ts`, `lib/trace/tree.ts`, `components/trace-viewer/SpanColors.ts`, `stores/refresh.ts`, `stores/load-state.svelte.ts`, `lib/api/client.ts`. Keep the existing `mount`/`flushSync` pattern; no testing-library dependency needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 format.ts, tree.ts and load-state have vitest coverage for their branches (compact numbers, 8-decimal costs, tree building with missing parents, load-state transitions)
- [ ] #2 `bun run test:dashboard` passes
<!-- AC:END -->
