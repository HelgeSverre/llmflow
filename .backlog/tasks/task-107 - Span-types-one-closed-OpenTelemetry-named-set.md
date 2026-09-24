---
id: TASK-107
title: 'Span types: one closed OpenTelemetry-named set'
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
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CONTEXT.md settles span types as llm, embedding, retrieval, tool, agent, workflow, custom. Today the DB defaults to llm and POST /api/spans to custom; OTLP ingest maps Traceloop workflow to 'trace' and task/invoke_workflow to 'chain'; the SDK offers 'trace' (its README claims special styling that does not exist); dashboard badges style 'workflow' (never produced) and match by substring; export has no mapping for trace/custom.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ingest, POST /api/spans, the SDK SpanType and export use exactly llm, embedding, retrieval, tool, agent, workflow, custom
- [ ] #2 Traceloop workflow/task and GenAI invoke_workflow map to workflow; a migration step rewrites stored chain/trace span types to workflow
- [ ] #3 Dashboard badges match span types exactly and show each of the seven
<!-- AC:END -->
