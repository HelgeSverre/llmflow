---
id: TASK-111
title: 'Proxy, model, telemetry and retention wording follows the glossary'
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
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CONTEXT.md settles translated/passthrough calls (not native/normalized), model = the model the response reports, ingest/export (export is not 'forward'; the proxy forwards calls), log (not log record/event), data point (not metric point/measurement/observation), related logs (not correlation), eviction (not pruning). OTLP ingest currently prefers gen_ai.request.model over gen_ai.response.model; config descriptions say 'pruned'; the UI says 'View measurements' and 'observations'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OTLP ingest records gen_ai.response.model when present, else the requested model
- [ ] #2 UI text, config descriptions (then bun run env:docs), README, llms.txt and the website use the glossary terms; grep for the avoided words finds only identifiers slated for renaming or quotes of external names
- [ ] #3 SDK README no longer promises tag filtering that does not exist, or the feature is tracked in its own task
<!-- AC:END -->
