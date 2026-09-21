---
id: TASK-22
title: Adopt OpenTelemetry GenAI semantic conventions (2026-05-27 snapshot)
status: Done
assignee: []
created_date: '2026-05-27 14:00'
updated_date: '2026-09-21 09:43'
labels:
  - otel
  - semconv
  - genai
  - compatibility
dependencies: []
references:
  - packages/otlp/src/traces.js
  - packages/otlp/src/export.js
  - apps/server/test/demo.js
  - apps/server/test/otlp-e2e.js
  - apps/server/test/telemetry-regressions.test.ts
  - docs/guides/genai-semconv.md
modified_files:
  - packages/otlp/src/traces.js
  - packages/otlp/src/export.js
  - apps/server/test/demo.js
  - apps/server/test/otlp-e2e.js
  - docs/
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the GenAI conventions snapshot captured on 2026-05-27: accept new and historical ingestion attributes, prefer structured messages, retain request/response/agent metadata, emit the new export names, and supply OTLP demos, regression tests and documentation. This is a dated implementation target, not a claim of compliance with every later Development-spec revision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 OTLP ingest accepts BOTH old (`gen_ai.system`, `gen_ai.usage.prompt_tokens`, `gen_ai.usage.completion_tokens`, `gen_ai.prompt`, `gen_ai.completion`) and new (`gen_ai.provider.name`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.input.messages`, `gen_ai.output.messages`) attribute names without regressing existing tests
- [x] #2 `gen_ai.operation.name` is read and surfaced — used to derive span_type (chat/text_completion → llm, embeddings → embedding, execute_tool → tool, invoke_agent/create_agent → agent, invoke_workflow → trace/chain, retrieval → retrieval)
- [x] #3 New token fields captured into DB or attributes blob: `gen_ai.usage.cache_creation.input_tokens`, `gen_ai.usage.cache_read.input_tokens`, `gen_ai.usage.reasoning.output_tokens` (so o1-style and Anthropic prompt-caching usage is visible)
- [x] #4 Response fields captured: `gen_ai.response.id`, `gen_ai.response.model`, `gen_ai.response.finish_reasons`, `gen_ai.response.time_to_first_chunk`
- [x] #5 Request parameters captured: `gen_ai.request.temperature`, `top_p`, `top_k`, `max_tokens`, `frequency_penalty`, `presence_penalty`, `stop_sequences`, `seed`, `choice.count`, `stream`, `encoding_formats`
- [x] #6 Structured message attributes `gen_ai.input.messages` / `gen_ai.output.messages` parsed and used as input/output when present (preferring them over the deprecated `gen_ai.prompt` / `gen_ai.completion`)
- [x] #7 Agent/workflow attributes captured: `gen_ai.agent.id`, `gen_ai.agent.name`, `gen_ai.agent.description`, `gen_ai.agent.version`, `gen_ai.workflow.name`
- [x] #8 OTLP export (`packages/otlp/src/export.js`) emits the **new** attribute names (`gen_ai.provider.name`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`) and includes `gen_ai.operation.name`; optionally emits deprecated names behind a flag for backward compatibility
- [x] #9 `apps/server/test/demo.js` is rewritten to POST OTLP/HTTP JSON to `/v1/traces` (not the proprietary `/api/spans`) using spec-compliant span names (`{operation.name} {model}`), 32-hex trace IDs, 16-hex span IDs, nanosecond timestamps, and realistic token counts so cost rollups light up
- [x] #10 Demo includes a nested example: `invoke_workflow {workflow}` → `invoke_agent {agent}` → `execute_tool {tool}` + `chat {model}`, with `gen_ai.conversation.id` and `session.id` set
- [x] #11 OTLP e2e tests extended to assert ingestion of new attribute names alongside the existing deprecated-name tests
- [x] #12 README / docs section added explaining the supported GenAI semconv keys (old + new), with a link to the OTel spec and a note about `OTEL_SEMCONV_STABILITY_OPT_IN`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Completed against the dated task target: ingestion precedence and operation mapping, structured messages and attribute preservation, modern export names, nested OTLP demos, regression coverage and docs/guides/genai-semconv.md. Preserve valid ingestion aliases for real older instrumentations; no unimplemented legacy-export flag is advertised.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-21 reconciliation: Implementation evidence covers the twelve criteria. Removed the floating latest-spec claim and obsolete optional LLMFLOW_OTLP_LEGACY_ATTRS proposal. Final completion awaits the current server regression run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the GenAI conventions target captured on 2026-05-27: modern and legacy ingestion aliases, operation mapping, structured messages, metadata retention, modern export attributes, nested OTLP demos and documented precedence. The current server suite and real Python protobuf/gzip exporter integration pass. This dated completion does not claim automatic compliance with later spec revisions.
<!-- SECTION:FINAL_SUMMARY:END -->
