---
id: doc-1
title: Backlog reconciliation — 2026-09-21
type: other
created_date: '2026-09-21 09:43'
updated_date: '2026-09-21 09:56'
---
> Historical implementation audit, before the subsequent product-scope pruning. For the current eight-task queue and local-tool priorities, see [Product scope and focused backlog](doc-2%20-%20Product-scope-and-focused-backlog.md). The dispositions below record the earlier audit, not current task states.

Reviewed all 27 existing tasks against the current local implementation on 2026-09-21. Backlog changes were made through the Backlog CLI. Historical implementation notes are retained as history; descriptions, plans, criteria and completion states describe the current code.

## Disposition

| Task | Current disposition | Evidence or remaining work |
| --- | --- | --- |
| 1 | In Progress, 3/4 | Shared StreamSession handles incremental parsing and usage; total tool-call capture budget remains missing. |
| 2 | Done | Tag filtering uses json_each exact matching. |
| 3 | To Do | Trace counters and whole-trace retention exist; asynchronous maintenance and performance benchmark remain. |
| 4 | To Do | Capture limits exist in specific proxy paths, but configurable persisted request/response caps across signals do not. |
| 5 | To Do | LIKE search remains; FTS creation/backfill must be versioned, not inferred from equal row counts. |
| 6 | In Progress, 2/4 | Loopback defaults and safe Compose publishing exist; bearer authentication does not. |
| 7 | Done | Providers are typed ESM and expose the current StreamSession contract. |
| 8 | In Progress, 2/5 | schema_migrations and restart-safe steps exist; explicit named registration, legacy bootstrap integration and complete schema assertions remain. |
| 9 | To Do | Reclassified: CLI signal forwarding is not coordinated production shutdown. |
| 10 | Done | Bun healthcheck reads DASHBOARD_PORT with default 1337; prior container verification remains historical. |
| 11 | Done | Pricing health fields, bundled fallback location and freshness documentation match current code. |
| 12 | To Do | Proxy/origin/transport extraction is complete; remaining server routing/lifecycle decomposition is not. |
| 13 | To Do | Normal close and failed-send cleanup exist; explicit heartbeat deadlines/observability remain. |
| 14 | To Do | Direct provider/stream tests exist; proposed package-local coverage and pricing tests remain. |
| 15 | To Do, 1/2 | Reopened: safe binding documentation exists, but planned bearer auth was incorrectly treated as complete. |
| 16 | Done | Default port is 1337; removed obsolete get-port behavior from the task. |
| 17 | To Do | Python exporter interoperability test is not a published Python SDK. |
| 18 | To Do | Go SDK remains unimplemented; use actual JavaScript SDK as behavioral reference. |
| 19 | To Do | Homebrew packaging remains future work and must match current Node/Bun artifact requirements. |
| 20 | To Do | Replay remains unimplemented and must obtain fresh provider credentials because stored credentials are redacted. |
| 21 | To Do | Cost threshold alerts are separate from the existing pricing freshness warning. |
| 22 | Done, 12/12 | Dated GenAI conventions target is implemented and tested; removed floating latest-spec claims and an unimplemented export-flag proposal. |
| 23 | Done | Viewport containment is covered by all-tab browser assertions. |
| 24 | To Do | Structured timeline details remain; removed unsupported metrics scope and already-fixed page overflow claim. |
| 25 | To Do | Conversation presentation remains; ingestion already supplies parsed message objects. |
| 26 | Archived, superseded | Flat API redesign was not implemented. Shared typed nested-tree adapter resolves the original UI need. |
| 27 | Done | All-29-issue verification record retained; historical test totals are not presented as current totals. |
| 28 | Done | UI contract/shortcut cleanup and this reconciliation, verified below. |

## UI fixes

Metric rows and summary cards now consume actual API fields and display integer, decimal, histogram and zero values. Unknown durations remain unknown while real zero duration/tokens/cost display as zero. Removed the unsupported Timeline Metrics path, unused date state, unused API/helper code and duplicate date-formatting branch. Refresh reloads the active tab; shortcuts reach all seven tabs and respect editable controls and modifier keys. Global hash/stats subscriptions now clean up on unmount.

The existing histogram browser fixture was corrected to match the count/sum columns and histogram object written by real OTLP ingestion. New browser assertions use actual OTLP requests rather than mocked UI data.

## Verification

- 90 Chromium Playwright tests passed, including active-tab refresh, all tab shortcuts, exact metric values and missing/zero duration distinctions.
- 19 dashboard unit tests passed.
- All workspace typechecks passed; Svelte reported zero errors and warnings.
- Full server regression suite passed. Its optional Python case was subsequently run explicitly with the installed exporter environment: all six telemetry regression cases passed, including real Python protobuf/gzip export.
- Production dashboard/server build passed; generated public assets are current.
- git diff --check passed.
- All active task reference paths exist. No Done task has unchecked acceptance criteria. Superseded task 26 is archived rather than falsely marked complete.

Docker was not rerun during this reconciliation. External PyPI/Go/Homebrew publication was not asserted from local evidence. Remaining backlog features were not implemented as part of this UI cleanup.

Screenshot: ../assets/images/ui-metrics-2026-09-21.png

