---
id: TASK-100
title: >-
  Clean up examples: lockfiles, duplicate example, stale deps, env names, README
  index
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 09:55'
labels:
  - examples
milestone: m-0
dependencies:
  - TASK-84
  - TASK-94
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
- [ ] #1 No npm lockfiles under examples/; one AI SDK example; dependencies on current majors; every example dir listed in examples/README.md
- [ ] #2 Each example runs against a fresh local LLMFlow and produces a trace (checked manually, noted in the task)
<!-- AC:END -->

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
