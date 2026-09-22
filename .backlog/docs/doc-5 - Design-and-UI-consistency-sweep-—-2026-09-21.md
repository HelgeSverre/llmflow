---
id: doc-5
title: Design and UI consistency sweep — 2026-09-21
type: other
created_date: '2026-09-21 13:51'
updated_date: '2026-09-21 13:53'
tags:
  - ui
  - design
  - review
---
# LLMFlow design and UI consistency sweep

Review of commit 93a8d42, using isolated seeded data. Findings are design observations and proposed improvements, not implemented changes.

## Scope and result

Reviewed all seven tabs with seeded traces/logs/metrics, an empty Sessions state and a populated session containing a failed child span. Inspected dark and light themes, desktop 1440×900, narrow desktop 800×700 and phone-width 390×844. Reproduced a failed Models request and a nonfunctional metric-row click. Compared a correlated log across Logs and Timeline. Static source review confirmed the implementation behind the observations.

Fourteen grouped findings: five high-impact and nine medium-impact. These are actionable design/behavior findings, not a claim that every possible UI state or browser has been exhausted. The sweep did not modify production data or source files. Findings were subsequently recorded as backlog tasks.

High impact: D01, D07, D08, D10, D13. Medium impact: the remaining items. Browser evidence is linked below and stored alongside this report; screenshots are synthetic local data.

## Findings

### D01 — Primary trace table is squeezed before selection (high)
At 1440×900 the unselected Traces view allocates roughly 456px to eight columns and most width to an empty detail panel. Names, models and times wrap; status clips; horizontal scrolling is required. Evidence: traces.png. Improvement: full-width table before selection; selection opens a meaningful-width inspector. Compact table columns when inspector is open. Keep name and status legible at 1280/1440 widths.

### D02 — Timeline log cards hide the useful payload (medium)
Most log cards display the repeated event name, service text and the same service again as a badge. Actual log body is absent from the list, so several semantically different events look identical. Evidence: timeline.png. Improvement: event as metadata, body preview as primary text, service once, severity next to timestamp. Make error traces visibly errors in the same feed.

### D03 — Empty states have incompatible structure and no next step (medium)
Sessions shows disabled pagination, 0–0 of 0, a no-sessions sentence and an empty table header. Logs renders BODY/ATTRIBUTES/RESOURCE with dash and empty JSON before selection. Timeline only says Select an item; Traces uses a centered instruction. Evidence: sessions.png, logs.png, timeline.png, traces.png. Improvement: separate first-run, no-results and no-selection states; explain how sessions are created; omit meaningless pagination and fake empty payloads.

### D04 — Aggregate cards lack investigation actions and scope (medium)
Models is a grid of metrics with no time selector, sorting or route to matching requests; metric cards show aggregates and bare values without units or a visible interval. The API supplies ms, MB and tokens for the seeded measurements, but these units are absent from the card/table values. Evidence: models.png, metrics.png. Improvement: display scope/time range and units, offer cost/request sorting and a direct View traces action for each model; metric-series card should open the matching series/detail.

### D05 — Session details are IDs rather than an investigation view (medium)
A session heading is a full UUID. Its only trace row shows a truncated trace ID, time, span count, cost and a small error label; the human-readable root name is absent despite being available in the trace. Most of the page is unused. It says '1 traces' and '1 errors'; timestamp style differs from the main tables. Evidence: session-detail.png. Improvement: use root/agent/service context as title and row primary text; expose IDs secondarily with copy, show named summary fields, correct plurals and link directly to the failed span.

### D06 — Analytics charts are hard to interpret (medium)
Token trends have neither visible date ticks nor a numeric scale; total/prompt overlays require hover to interpret. Cost labels truncate distinguishable model suffixes. Daily summary starts with the oldest zero-activity days, burying recent work under a nested scroll. 'Cost by Tool' actually lists service names. Evidence: analytics.png. Improvement: date/scale ticks and prompt/completion legend; accessible daily values; newest-first daily rows; more width for model identity; rename Service unless attribution genuinely represents a tool.

### D07 — Narrow layouts retain incompatible desktop structure (high)
At 800px the list stays at least 320px wide and waterfall names are heavily truncated. At 390px Sessions detail overflows its fixed grid and clips the error label; Traces stacks a horizontally scrollable table, waterfall and inspector into a cramped sequence. Evidence: traces-800.png, traces-390.png, session-390.png. Improvement: breakpoint based on usable panel widths (~1000–1100px); switch to list → detail navigation with an explicit Back action, flexible session rows and a name-first compact waterfall. No separate mobile app needed.

### D08 — Error/status semantics are inconsistent (high)
The failed tool in the waterfall is a yellow type-colored bar; the root row is OK while its descendant failed; the session knows an error exists. Timeline Failed Request is styled like success. Evidence: trace-detail.png, timeline.png, session-detail.png. Improvement: retain type color but add an explicit error icon/status to failing spans and child-error indicator on their parent trace; link from session error count to the failing span.

### D09 — Selecting a trace still requires another selection to see content (medium)
Selecting the root opens its tree but leaves the detail pane at 'Select a span to see its details.' A telemetry-only root also displays an enabled Replay request button despite being non-replayable. Evidence: trace-detail.png. Improvement: select the clicked span/root automatically; place replay in its request context and disable/hide it with a reason when unsupported. Explain replay consequences at the action. Default the inspector to populated input/output rather than an empty Attributes tab when that better matches the selected span.

### D10 — Affordances and keyboard reachability disagree (high)
Metrics rows use pointer/hover styling but clicking does nothing (metrics-dead-row.webm; metric-before.png → metric-after.png). Sessions rows are mouse-clickable but not keyboard controls. Main navigation announces ordinary buttons with no selected/current state, and combobox snapshots provide values but no accessible names. Improvement: remove false metric-row interactivity unless a useful detail is implemented; make session names native links/buttons; give navigation current state, explicit form labels, visible focus and consistent keyboard activation. Do not add a generic widget framework.

### D11 — Formatting and visual vocabulary drift between tabs (medium)
Sessions uses exact 4-decimal dollars, comma-separated tokens and 24h times; main views use <$0.01, compact K tokens and AM/PM. Session errors use raw red words/counts; trace table uses Error text; timeline log severity uses badges; waterfall uses type color alone. Session CSS refers to undefined --row-border, --row-hover and --font-mono. Improvement: agree semantic formatting rules (compact list vs exact detail), one timestamp/timezone policy, shared error/status treatment and valid existing theme tokens. Preserve small nonzero costs and show exact values in detail.

### D12 — Filter and refresh patterns vary without a clear reason (medium)
Timeline service is an exact-text input; Logs/Metrics service is a populated selector; Traces has no service filter; Sessions has no search. Only Analytics exposes Refresh, though other tabs support hidden keyboard refresh. Global header totals stay global while local filters change, without a scope label. Improvement: consistent labelled filter toolbar; service selector wherever service filtering exists; visible clear/result count and scope; searchable Sessions; standard refresh/live status where appropriate. Keep filter scopes explicit rather than silently linking unrelated tabs.

### D13 — Failed requests masquerade as empty datasets (high)
Aborting /api/models on first load renders 'No model data yet. Send requests through the proxy…' while the header already shows 18 traces. There is no error or Retry. Repro: route /api/models to network failure, load #models; failure-evidence.txt contains console errors, models-request-failed.png shows the UI, videos/ contains the recording. Source review confirms the same state ambiguity in multiple stores. Improvement: shared loading/empty/error/stale-data presentation; preserve existing results with a failed-refresh banner, offer Retry, never tell the user to ingest data on request failure.

### D14 — The same correlated log offers different navigation in different tabs (medium)
Logs detail displays a truncated trace ID as plain text; Timeline's detail of the same log offers Open trace. Model aggregates likewise cannot open the corresponding trace set. Improvement: consistent contextual actions (Open trace, Open session where known, Copy ID), passing the exact span/log context. Retain filters/selection when returning to the source view. Evidence: correlated-log.png, correlated-timeline.png; source LogDetail.svelte:14 and TimelineDetail.svelte:81.


## Concrete target behavior

- **Traces and Logs, nothing selected:** full-width result list/table. No empty payload sections. Name/message and status remain visible at 1280–1440px without horizontal scrolling through an arbitrary default split.
- **Trace selected:** show a compact name-first result list, waterfall, and useful detail. Select the clicked span automatically. Keep the full name discoverable, preserve user-resized widths, and provide an explicit close/back action. Preserve type color while separately flagging errors.
- **Narrow window:** switch to list → detail navigation once all panes cannot remain useful. Do not keep a compressed desktop table above a compressed tree and inspector. Session rows wrap into meaningful labelled metadata instead of overflowing a fixed grid.
- **Consistent toolbar:** labelled Search, relevant service/model/status selectors, explicit time scope, Clear filters, result count and a refresh/live indicator where applicable. Filters stay local unless deliberately made global. Label header stats as global/all-time and define whether Traces counts spans or trace groups.
- **Consistent states:** initial loading; empty dataset with setup guidance; zero filtered results with Clear filters; request failure with Retry; background refresh failure with retained data and a stale warning; no selection with one instruction. No blank JSON payloads masquerading as selection states.
- **Formatting:** compact values in overview lists; exact tokens and useful micro-cost precision in detail; explicit units; one timestamp/timezone policy; singular/plural nouns. Missing and zero remain distinct.
- **Cross-view navigation:** Open trace from either log presentation; Open failed span from sessions; View traces from model costs. Preserve source-view context on return. Expose full IDs secondarily with Copy ID.

## Recommended delivery sequence

| Batch | Scope | Included findings | Completion check |
|---|---|---|---|
| 1. Make states and actions truthful | Visible loading/error/Retry, consistent failed-span cues, remove dead metric click styling, explain unavailable Replay | D08, D10 (dead rows), D13, part of D09 | Failed API never renders onboarding; failed span is visibly identifiable; every enabled action has an outcome |
| 2. Fix investigation layout | Full-width unselected lists, compact selected lists, useful automatic span selection, explicit close/back, narrow-window behavior | D01, D07, remaining D09 | At 1440 and 800px the selected record and useful content remain readable; at 390px actions and session status do not clip |
| 3. Make logs and sessions useful | Message-first timeline cards, named session traces, consistent correlation actions and useful empty states | D02, D03, D05, D14 | Identify the relevant error from the list, then reach its exact span without ID guessing |
| 4. Normalize controls and values | Labels/current nav state, native session actions, shared formatting rules, valid theme tokens, consistent filter/scope/refresh patterns | D10 (keyboard/labels), D11, D12 | Entire session-to-span workflow works by keyboard; selected filters retain meaningful labels; precision and scope are explicit |
| 5. Improve summaries | Metric units/scope, model sort/drill-down, labelled charts, service terminology, recent-first daily rows | D04, D06 | Answer which model/service costs most and inspect its requests without reconstructing filters manually |

The first four batches improve existing workflows. Chart drill-down and new time filters may require API work; treat them as product improvements with explicit scope rather than incidental visual cleanup.

## Implementation references

| Finding | Primary locations |
|---|---|
| D01, D07 | [Shared layout CSS](/Users/helge/code/llmflow/apps/dashboard/src/app.css:261), [responsive rules](/Users/helge/code/llmflow/apps/dashboard/src/app.css:1120), [session grid](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/sessions/SessionDetail.svelte:70) |
| D02 | [Timeline item construction](/Users/helge/code/llmflow/apps/server/src/server.ts:641), [Timeline cards](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/timeline/TimelineList.svelte:52) |
| D03 | [Session empty state](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/sessions/SessionList.svelte:22), [Log detail](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/logs/LogDetail.svelte:14) |
| D04 | [Model cards](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/models/ModelsTab.svelte:27), [metric values](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/metrics/MetricsTable.svelte:6) |
| D05 | [Session detail](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/sessions/SessionDetail.svelte:20) |
| D06 | [Chart bars](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/analytics/AnalyticsTab.svelte:71), [service attribution](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/analytics/AnalyticsTab.svelte:106), [daily table](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/analytics/AnalyticsTab.svelte:192) |
| D08 | [Waterfall status omission](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/trace-viewer/SpanRow.svelte:53), [type colors](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/trace-viewer/SpanColors.ts:14) |
| D09 | [Selection reset and Replay](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/traces/TraceDetail.svelte:30) |
| D10 | [Main navigation](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/layout/Tabs.svelte:15), [session mouse-only rows](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/sessions/SessionList.svelte:58), [metric rows](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/metrics/MetricsTable.svelte:38) |
| D11 | [Session formatting](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/sessions/SessionList.svelte:65), [undefined session CSS tokens](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/sessions/SessionList.svelte:88) |
| D12 | [Header scope](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/layout/Header.svelte:71), [Timeline filters](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/timeline/TimelineTab.svelte:58), [Logs filters](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/logs/LogsTab.svelte:66) |
| D13 | [Models error handling](/Users/helge/code/llmflow/apps/dashboard/src/lib/stores/models.svelte.ts:15), [Logs error handling](/Users/helge/code/llmflow/apps/dashboard/src/lib/stores/logs.svelte.ts:46), [Analytics error handling](/Users/helge/code/llmflow/apps/dashboard/src/lib/stores/analytics.svelte.ts:38) |
| D14 | [Logs correlation text](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/logs/LogDetail.svelte:14), [Timeline correlation action](/Users/helge/code/llmflow/apps/dashboard/src/lib/components/timeline/TimelineDetail.svelte:81) |

## Evidence highlights

- [Squeezed trace table](assets/design-sweep-2026-09-21/traces.png)
- [Selected trace with empty inspector](assets/design-sweep-2026-09-21/trace-detail.png)
- [Failed span without an error cue in the waterfall](assets/design-sweep-2026-09-21/span-detail.png)
- [Timeline repeated metadata](assets/design-sweep-2026-09-21/timeline.png)
- [Sessions empty state](assets/design-sweep-2026-09-21/sessions.png)
- [Session identification/formatting](assets/design-sweep-2026-09-21/session-detail.png)
- [Narrow session clipping](assets/design-sweep-2026-09-21/session-390.png)
- [Analytics desktop](assets/design-sweep-2026-09-21/analytics-light.png) and [phone-width](assets/design-sweep-2026-09-21/analytics-mobile.png)
- [Metric click before](assets/design-sweep-2026-09-21/metric-before.png), [after](assets/design-sweep-2026-09-21/metric-after.png), [recording](assets/design-sweep-2026-09-21/metrics-dead-row.webm)
- [Failed Models request shown as no data](assets/design-sweep-2026-09-21/models-request-failed.png), [console evidence](assets/design-sweep-2026-09-21/failure-evidence.txt)
- [Correlated log in Logs](assets/design-sweep-2026-09-21/correlated-log.png), [same log in Timeline](assets/design-sweep-2026-09-21/correlated-timeline.png)

Recommended reuse is small and tied to behavior: labelled toolbar controls, consistent request-state presentation, status badges, value formatters and contextual navigation actions. No new design-system package, broad component relocation, security project or framework rewrite is needed.

[Models request failure recording](assets/design-sweep-2026-09-21/page@98349ec8c35acf0b3fe76437b8cc1583.webm)


## Backlog task mapping

- TASK-51 — D13: Distinguish dashboard request failures from empty data
- TASK-52 — D08: Expose failed spans and descendant errors consistently
- TASK-53 — D10: Make dashboard controls keyboard-accessible and remove dead click cues
- TASK-54 — D09: Open useful trace details immediately and explain unavailable Replay
- TASK-55 — D01: Give trace and log lists useful space before and after selection
- TASK-56 — D07: Adapt investigation layouts to narrow windows without clipped content
- TASK-57 — D02: Show log messages prominently in Timeline cards
- TASK-58 — D03: Make empty and unselected dashboard states useful and consistent
- TASK-59 — D05: Make Sessions navigable by trace names and failure context
- TASK-60 — D14: Provide consistent correlated-log navigation across Logs and Timeline
- TASK-61 — D11: Standardize value formatting and repair session theme styling
- TASK-62 — D12: Make dashboard filter scope and refresh behavior explicit
- TASK-63 — D04: Make model and metric summaries interpretable and actionable
- TASK-64 — D06: Make analytics charts readable and daily activity easy to inspect
