---
id: TASK-88
title: Delete the API routes and DB code nothing calls
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 18:22'
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
- [x] #1 Listed routes, DB helpers, table and filter fields are removed and grep shows no references; dashboard, SDK, examples and tests still pass
- [x] #2 release-notes for the next version list the removed endpoints
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm no consumer (dashboard, SDK, examples, e2e, tests) for each item. 2. Remove routes, provider health handler and trace_log_added broadcast. 3. Remove DB helpers, unreachable filters, stats models; migration drops stats_cache. 4. Remove provider default exports, Provider type, unused configs and passthrough hooks. 5. Update tests; release-notes/UNRELEASED.md. 6. Gate + Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- Consumers checked by grep across apps/dashboard/src, e2e, packages/sdk, examples and tests: the dashboard only calls GET /api/analytics (combined); its token-trends card is fed from daily. None of the removed routes had a caller.
- Also removed because the removals left them without callers: db.getTokenTrends (only the token-trends route used it; its tests in packages/db/src/analytics.test.ts removed). getTokenUsage stays (GET /api/metrics/tokens), getMetricsSummary stays (/api/metrics?aggregation=summary).
- TraceFilters: neither place that builds filters (GET /api/traces, the second site in server.ts) ever set tag/span_type/cost_min/cost_max, so those SQL branches were unreachable. The tag exact-match from TASK-2 was among them.
- stats_cache: CREATE removed from the schema; migrations.ts step 5 = DROP TABLE IF EXISTS stats_cache for existing DBs (database-regressions test now expects 5 migrations and asserts the table is gone).
- getStats() no longer computes models (it ran getModelStats on every stats_update broadcast); dashboard Stats reads only total_requests/total_tokens/total_cost/avg_duration.
- @llmflow/db no longer exports DB_PATH/DATA_DIR; env-example.test.ts checks '~' expansion via the created data.db instead.
- providers: no default exports, no 'type Provider'; OpenAI/Anthropic/Gemini/Cohere/Ollama constructors take no config (hosts are constants; Ollama still reads OLLAMA_HOST/OLLAMA_PORT). Azure keeps its config (tests pass resource; production reads AZURE_OPENAI_*). OpenAICompatibleProvider keeps its config (used by the Groq/Mistral/... instances).
- PassthroughHandler: extractUsage/identifyModel/headerTransform are now plain overridable methods (the former default* methods); the hook options and fields are gone. TASK-91 builds on this.
- release-notes/UNRELEASED.md created (convention from comment #1): removed endpoints with replacements, plus the user-visible changes of TASK-81..84.
Validation: bun run check green; bun run test 216 pass/1 skip + dashboard 116; Playwright 125 passed; final grep finds only the intentional migration/test references.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:16
---
Release-notes convention: record removals in release-notes/UNRELEASED.md; just release (TASK-98) renames it to release-notes/v<version>.md at release time.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Deleted the unused API routes (token-usage, metrics/summary, analytics sub-routes, health/providers), the trace_log_added broadcast, dead DB helpers, unreachable trace filters, getStats models and the stats_cache table (dropped by migration), plus unused provider exports, configs and passthrough hooks; documented the removals in release-notes/UNRELEASED.md. Verified with bun run check/test, Playwright and a repo-wide grep.
<!-- SECTION:FINAL_SUMMARY:END -->
