---
id: TASK-1
title: Stream-parse SSE bodies instead of buffering full response
status: To Do
assignee: []
created_date: '2026-05-27 02:20'
labels:
  - perf
  - p1
dependencies: []
references:
  - 'apps/server/src/server.ts:1177'
  - 'apps/server/src/server.ts:1191'
  - 'apps/server/src/server.ts:1443'
  - 'todos.md:77'
modified_files:
  - apps/server/src/server.ts
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
processStreamForLogging and processPassthroughStreamForLogging both append every decoded chunk to a growing streamBuffer string until done, then parse once. A 1M-token Claude generation holds multi-MB of UTF-16 per concurrent stream. Parse per-line, accumulate the final usage block, discard chunks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Per-line SSE parsing replaces the growing streamBuffer string
- [ ] #2 Usage extraction (prompt_tokens, completion_tokens, total_tokens) remains accurate across OpenAI, Anthropic, and Gemini stream formats
- [ ] #3 Passthrough streaming logger (processPassthroughStreamForLogging) updated with the same approach
- [ ] #4 Memory footprint per concurrent stream stays bounded regardless of total token count
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use TextDecoder + a line-buffer pattern: read chunk, split on newlines, keep the trailing partial-line in a small buffer. Each complete line goes to provider.parseStreamChunk which accumulates only the final 'usage' / 'finish_reason' payload. Discard everything else. Mirror the change in the passthrough variant.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
<!-- DOD:END -->
