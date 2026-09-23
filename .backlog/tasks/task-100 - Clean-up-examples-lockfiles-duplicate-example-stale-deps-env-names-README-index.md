---
id: TASK-100
title: >-
  Clean up examples: lockfiles, duplicate example, stale deps, env names, README
  index
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 20:54'
labels:
  - examples
milestone: m-0
dependencies:
  - TASK-84
  - TASK-94
  - TASK-105
references:
  - examples/README.md
  - examples/vercel-ai-sdk/index.js
  - examples/rag-pipeline/index.js
priority: medium
type: chore
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
- 4 `examples/*/package-lock.json` npm lockfiles in a Bun repo while every README says `bun install` (Bun converts and writes an untracked bun.lock).
- `examples/vercel-ai-sdk/index.js` ≡ `examples/ai-sdk-proxy/index.js` except its header, which falsely claims OTLP export.
- Deps on old majors: `ai@^4`, `@ai-sdk/openai@^1`, `langchain@^0.3`.
- `examples/README.md:7-13` table omits aider/, codex-cli/, gemini-cli/, observability/. `examples/observability/README.md:41` references a nonexistent `node test.js`.
- `rag-pipeline/index.js:26` imports the SDK via `../../packages/sdk/index.js`; switch to the workspace package / published `llmflow-sdk` once M5 lands.
- Env names differ from the rest of the repo (see naming task).
Verify each example actually runs against a local LLMFlow (`run-all.sh` or per-example) before closing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No npm lockfiles under examples/; one AI SDK example; dependencies on current majors; every example dir listed in examples/README.md
- [x] #2 Each example runs against a fresh local LLMFlow and produces a trace (checked manually, noted in the task)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Dependencies to current majors; adapt code. 2. rag-pipeline -> llmflow-sdk via file: dependency. 3. Complete examples/README index; fix stale docs. 4. Run every example against a fresh local LLMFlow and record results.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done (commit 6417389):
- Deps: ai ^7.0.112 + @ai-sdk/openai ^4.0.73; langchain ^1.5.12 + @langchain/openai ^1.5.13 + @langchain/core ^1.2.12 (ChatOpenAI 'modelName' -> 'model'); openai ^7.23.0. AI SDK v5+ openai(model) uses the Responses API, which the proxy handles.
- rag-pipeline: 'llmflow-sdk': 'file:../../packages/sdk', imports from 'llmflow-sdk', prestart builds the SDK dist. packages/sdk dropped its 'typescript: catalog:' devDependency — catalog: cannot resolve outside the workspace (bun install failed); the SDK build uses the root tsc like every other package.
- examples/README.md lists all 8 example directories. The 'node test.js' reference was already gone. Example bun.lock files stay gitignored (.gitignore examples/*/bun.lock).
- gemini-cli README rewritten: the old GEMINI_TELEMETRY_ENDPOINT / telemetry.endpoint do not exist in Gemini CLI 0.42; it reads GEMINI_TELEMETRY_ENABLED/TARGET/OTLP_ENDPOINT (base URL; it appends /v1/logs and /v1/metrics)/OTLP_PROTOCOL or telemetry.{enabled,target,otlpEndpoint,otlpProtocol} (checked in the installed bundle).
- Phoenix: accepts OTLP protobuf only (JSON -> 415). Its .env.example and README now set OTLP_EXPORT_PROTOCOL=http/protobuf; observability README lists the setting.
Run verification against a fresh LLMFlow (temp DATA_DIR, free ports), 2026-09-23:
- ai-sdk-proxy: exit 0, 3 spans (real OpenAI calls).
- langchain: exit 0, 3 spans.
- rag-pipeline: exit 0, 16 spans; tree rag-query -> embed_query, vector_search, rerank_results, and the proxied openai gpt-4o-mini call linked via wrapOpenAI headers. Observation: SDK child spans do not inherit the root's serviceName (show unknown_service) — possible SDK follow-up.
- claude-code (Claude Code 2.1.281, run-with-llmflow.sh + ANTHROPIC_BASE_URL passthrough): answered; 21 OTLP logs, 7 metric points, passthrough spans with provider 'anthropic'.
- codex-cli (0.156.1, same settings as the README passed via -c, no global config change): answered; 18 OTLP logs, service codex_exec.
- gemini-cli (0.42.0): telemetry verified (11 logs incl. gemini_cli.user_prompt, 4 metric points, service gemini-cli); the model call itself fails with IneligibleTierError (the user's Gemini account tier no longer serves this client) — account issue, not LLMFlow.
- observability/jaeger (docker): span exported from LLMFlow shows in Jaeger with gen_ai.request.model and session.id.
- observability/phoenix (docker): trace received over http/protobuf after the fix.
NOT VERIFIED (blocks AC2): aider (not installed on this machine); observability/langfuse and observability/opik (multi-container stacks needing project API keys); observability/helicone (needs a Helicone account key). Needs the user to install aider / provide keys, or to accept these as unverified.

2026-09-23: examples/aider removed at the user's request (never verified; not installed here), with its examples/README row and the website card. Remaining unverified: observability/langfuse, observability/opik, observability/helicone.

Observability examples, 2026-09-23: Helicone example removed (Helicone is a proxy, not an OTLP backend; the server's /passthrough/helicone route stays). Langfuse rebuilt on Langfuse's own docker-compose.yml + headless init (langfuse.env) + an override keeping Postgres/Redis/ClickHouse off host ports; checked with Langfuse 4.43: GENERATION with model, usage 12/4/16, sessionId. Opik rebuilt on opik.sh (old compose used a nonexistent image); checked with Opik 2.2.79: JSON and protobuf export to :5173/api/v1/private/otel/v1/traces with projectName header, model/provider/usage/cost present, conversation ID -> thread. Found and fixed: POST /api/spans stored total_tokens 0 when omitted (now prompt+completion, with a test). Every remaining example is now checked; gemini-cli is telemetry-only because of the account tier. Commit f88dda0.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Examples are not workspace members, so workspace:* is not available there. Use "llmflow-sdk": "file:../../packages/sdk" until the package is published (TASK-98), then the published version range.
---

created: 2026-09-23 09:55
---
Done ahead of time (2026-09-23): examples/vercel-ai-sdk and the four npm lockfiles are deleted; README row and run-all.sh loop updated. Remaining scope: dependency majors, env names, run verification, SDK linking, missing README rows.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Examples cleaned up: npm lockfiles gone, one AI SDK example, current majors, full index. Aider and Helicone removed; Langfuse and Opik rebuilt on their official self-hosting. Every example run against a local LLMFlow (gemini-cli telemetry only). Fixed POST /api/spans total_tokens along the way.
<!-- SECTION:FINAL_SUMMARY:END -->
