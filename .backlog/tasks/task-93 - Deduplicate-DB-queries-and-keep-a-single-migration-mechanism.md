---
id: TASK-93
title: Deduplicate DB queries and keep a single migration mechanism
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 19:05'
labels:
  - refactor
  - db
milestone: m-0
dependencies:
  - TASK-88
references:
  - packages/db/src/index.ts
  - packages/db/src/migrations.ts
priority: medium
type: task
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`packages/db/src/index.ts`: five "distinct values" helpers (:694, :908, :918, :1130, :1138); `getModelStats` (:1336) and `getCostByModel` (:1254) run the same GROUP BY with different aliases; two migration systems coexist (`ensureColumn` :42-47/:82-92 and the versioned `migrations.ts`). Server-side JSON-column parsing is done separately in `/api/traces/:id` (453-486) and `/tree` (503-515); the `if (get(x)) filters.x = …` pattern repeats in 409-426, 598-604, 679-688, 717-722 (move into the api split if that lands first).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One generic distinct-values helper, one model aggregate query, one migration mechanism (versioned) with existing DBs upgrading cleanly (test with a v0.4.1-shaped DB)
- [x] #2 Row JSON-column parsing is one function used by every trace endpoint
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Move the baseline schema into migrations.ts; ensureColumn columns become an idempotent step 6. 2. Fixture: dump a real v0.4.1 DB from commit 37341a1; test upgrade + schema parity with a fresh DB. 3. getDistinctValues, getModelAggregates, parseTraceRow replace the duplicates. 4. Gate + Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- One mechanism: packages/db/src/migrations.ts migrate(db) = createBaseline (the tables/indexes as they were before versioned migrations: traces base columns, logs, metrics) + numbered steps recorded in schema_migrations. index.ts just calls migrate(db). Steps: 1 credential scrub, 2 log timestamp repair, 3 trace groups/retention, 4 metric temporality columns, 5 drop stats_cache (TASK-88), 6 span/session columns + parent/session/conversation indexes (was ensureColumn; idempotent via PRAGMA table_info, so v0.2-v0.4 DBs that already have them only record the version). Append new steps; never reorder.
- Fixture packages/db/src/fixtures/v0.4.1.sql: sqlite3 .dump of a DB created by the v0.4.1 code (commit 37341a1, package version 0.4.1; no v0.4.x git tag exists) with 2 spans, 1 log, 1 metric, migrations 1-4, stats_cache. packages/db/src/migrations.test.ts: upgrade keeps rows and retention counts, records 1-6, drops stats_cache, is idempotent; upgraded DB has the same tables, columns and indexes as a fresh DB.
- apps/server/test/database-regressions 'historical ... execute once' now builds a realistic pre-v0.2 DB (baseline columns such as model/status exist in every real DB) and expects 6 migrations plus the step-6 columns.
- getDistinctValues(table, column): logs.{event_name,service_name}, metrics.{name,service_name}; anything else throws (names are interpolated into SQL).
- getModelAggregates({ from = 0, to?, orderBy = 'requests' | 'cost' }) -> ModelAggregate { model, provider, request_count, total_tokens, prompt_tokens, completion_tokens, total_cost, avg_latency }. /api/models (drops provider) and /api/analytics by_model (drops avg_latency; ordered by cost) keep their JSON shapes. Sums are now COALESCEd (by_model previously could return null sums).
- parseTraceRow(row) decodes request/response headers+bodies, input, output, attributes, tags with fixed fallbacks; used by GET /api/traces/:id, /api/traces/:id/tree and replay. The list endpoint returns no JSON columns.
- The repeated query-param pattern was already replaced by queryFilters() in the TASK-89 API split.
Validation: bun run check green; bun run test 228 pass/1 skip + dashboard 116 (new migrations tests; analytics tests on getModelAggregates); Playwright 125 passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made migrations.ts the single, versioned schema mechanism (baseline + numbered steps, former ensureColumn columns as an idempotent step), proven by upgrading a real v0.4.1 database fixture to the same schema as a fresh one; replaced the duplicated distinct-value helpers, the two model aggregates and the per-endpoint JSON parsing with one function each. Verified with new migration tests, bun run check/test and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
