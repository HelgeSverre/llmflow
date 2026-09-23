---
id: TASK-89
title: >-
  Split server.ts into api/otlp/static/proxy modules and share the port and
  startup helpers
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
labels:
  - refactor
milestone: m-0
dependencies:
  - TASK-88
  - TASK-85
references:
  - apps/server/src/server.ts
  - scripts/dev-runtime.ts
  - apps/dashboard/dev.ts
  - apps/server/src/replay.ts
priority: medium
type: task
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`server.ts` (1045 LOC) is not a god file by concern, but `handleApiRoute` (346-874) is a 528-line if-chain and the four passthrough blocks (965-991) are copy-paste of the `passthroughHandlers` map (27-32). CORS headers (996-1005) are added only to normalised responses, never to passthrough responses. Duplicated helpers: port parsing `server.ts:36-41` ≡ `scripts/dev-runtime.ts:20-26`; busy-port fallback `dev-runtime.ts:27-34` ≡ `apps/dashboard/dev.ts:57-63`; loopback rewrite `dev-runtime.ts:83-87` ≡ `dev.ts:67-72` ≡ host list in `websocket-origin.ts:17-19`; free-port helper ×3 (`run-tests.js`, `playwright.config.ts:4-15`, `test-package.ts:4-9`); health polling ×2; `main()` (1012-1041) vs `scripts/dev.ts:39-90` (dev shutdown skips `flushAll()`). Gemini key precedence differs (`server.ts:275` GOOGLE first vs `replay.ts:9` GEMINI first); `OLLAMA_HOST/PORT` parsed in `server.ts:321-322` and `providers/src/ollama.ts:19-20`.
Target: `api.ts` (routes table or small handlers per resource), `otlp-routes.ts`, `static.ts`, `proxy-server.ts`, `server.ts` ≈ 300 lines; one `net.ts` helper module used by server, dev scripts, tests and playwright config.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 server.ts is under ~300 lines and owns only wiring; API handlers live in per-resource modules; passthrough routes come from the handler map in a loop; CORS applies to every proxy response
- [ ] #2 Port parsing, busy-port fallback, loopback rewrite, free-port and health polling each exist exactly once and are imported everywhere they are used
- [ ] #3 Provider key precedence is defined once and shared by proxy and replay
<!-- AC:END -->
