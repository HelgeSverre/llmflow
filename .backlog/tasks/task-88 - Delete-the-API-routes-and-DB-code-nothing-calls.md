---
id: TASK-88
title: Delete the API routes and DB code nothing calls
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - dead-code
milestone: m-0
dependencies:
  - TASK-77
references:
  - apps/server/src/server.ts
  - packages/db/src/index.ts
  - packages/providers/src/passthrough.ts
priority: high
type: chore
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision: delete (local dev tool, no known external consumers; announced in release-notes/v0.3.0, so note the removal in the next release notes).

Routes in `apps/server/src/server.ts` with no consumer in dashboard, SDK, examples or tests: `/api/token-usage` (768-771, duplicates `/api/metrics/tokens`), `/api/metrics/summary` (774-783, duplicates `?aggregation=summary`), `/api/analytics/{daily,cost-by-tool,cost-by-model,token-trends}` (795-818), `/api/health/providers` (201-344, 145 LOC), WebSocket message `trace_log_added` (88-93, no listener).
DB (`packages/db/src/index.ts`): `getDistinctModels` (:694), `getLogsByTraceId` (:869), `export { DB_PATH, DATA_DIR }` (:1334), `TraceFilters.cost_min/cost_max/span_type/tag` (:472-476; SQL at :582-595, :618-621 unreachable), `stats_cache` table (:98-104, never read/written), `models` computed in `getStats` (:682) on every WebSocket stats broadcast though the dashboard reads 4 fields.
Also dead: `packages/providers` `export default` in all 8 adapters, `type Provider` (`base.ts:132`), the never-passed hook options `extractUsage/identifyModel/headerTransform` (`passthrough.ts:30-39,76-79`) and constructor configs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Listed routes, DB helpers, table and filter fields are removed and grep shows no references; dashboard, SDK, examples and tests still pass
- [ ] #2 release-notes for the next version list the removed endpoints
<!-- AC:END -->
