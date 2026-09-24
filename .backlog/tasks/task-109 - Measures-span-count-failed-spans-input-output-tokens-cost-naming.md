---
id: TASK-109
title: 'Measures: span count, failed spans, input/output tokens, cost naming'
status: To Do
assignee: []
created_date: '2026-09-24 01:32'
updated_date: '2026-09-24 01:32'
labels:
  - vocabulary
  - ready-for-agent
milestone: m-1
dependencies: []
references:
  - CONTEXT.md
priority: high
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CONTEXT.md settles span count (not request_count/Requests), one definition of a failed span (error status or error message), input/output tokens (not prompt/completion, following OpenTelemetry), and cost/pricing/bundled pricing/placeholder rate. Today /api/stats request_count counts every span and is labelled Spans in the header but Requests in Models/Analytics; error_count counts only status >= 400 while filters and badges also count error messages; spans store prompt_tokens/completion_tokens; cost is estimated_cost/total_cost/cost/spend; 'fallback' means both bundled pricing and the placeholder rate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 API, WebSocket and UI use span_count / 'Spans' for counts of spans
- [ ] #2 error_count and every failed-span filter and badge use the same definition
- [ ] #3 Span columns, API JSON, SDK and UI use input_tokens/output_tokens via a new migration step; ingest and export keep the OpenTelemetry attribute names
- [ ] #4 Cost and pricing wording in UI, config descriptions and docs uses cost, bundled pricing and placeholder rate
- [ ] #5 Breaking API changes are listed in release-notes/UNRELEASED.md
<!-- AC:END -->
