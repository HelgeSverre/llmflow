---
id: TASK-89
title: >-
  Split server.ts into api/otlp/static/proxy modules and share the port and
  startup helpers
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 18:42'
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
- [x] #1 server.ts is under ~300 lines and owns only wiring; API handlers live in per-resource modules; passthrough routes come from the handler map in a loop; CORS applies to every proxy response
- [x] #2 Port parsing, busy-port fallback, loopback rewrite, free-port and health polling each exist exactly once and are imported everywhere they are used
- [x] #3 Provider key precedence is defined once and shared by proxy and replay
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. @llmflow/shared/net for port parsing, loopback rules, free port, health polling; dev-runtime available() for sync+async busy-port fallback. 2. Split server.ts: api/ route table + per-resource handlers, otlp-routes, static, live, proxy-server. 3. Passthrough routes from the handler map; CORS on every proxy response. 4. Provider key precedence in @llmflow/providers/credentials. 5. Tests + gate + test:package + Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- apps/server/src layout: server.ts (80 lines: host/port config, startDashboardServer, startProxyServer, main), api/index.ts (route table + error handling), api/router.ts (match(), queryFilters(), page(), notFound()), api/{overview,traces,sessions,timeline,logs,metrics}.ts, otlp-routes.ts, static.ts, live.ts (WebSocket clients + db subscriptions, subscribed on import as before), proxy-server.ts (createProxyServer), proxy.ts, replay.ts, websocket-origin.ts.
- Routes are [method, exact path | RegExp, handler]; exact /api/metrics/{tokens,filters} precede /api/metrics/:id. Path params are now URI-decoded for every route (before: only sessions and replay); malformed escapes fall back to the raw value.
- startDashboardServer/startProxyServer keep their signatures (dev script, test helper and tests unchanged).
- Proxy: passthrough routes loop over the handler map (anthropic, gemini, openai, helicone); every response goes through withCors (before: only non-passthrough forwards). New test apps/server/test/proxy-cors.test.ts.
- @llmflow/shared/net (node: built-ins only, because playwright.config.ts imports it under Node; Node 22.18+/Playwright's loader strip the types): parsePort, LOOPBACK_HOSTS, clientHost, clientUrl, freePort, waitUntil, waitForHealth. Users: server.ts, dev-runtime, apps/server/scripts/dev.ts, apps/dashboard/dev.ts, websocket-origin.ts, dev-startup.test.ts, scripts/test-package.ts, playwright.config.ts.
- Busy-port fallback exists once: @llmflow/dev-runtime available(label, preferred, listen) — works with a throwing listen (Bun.serve) and a rejecting promise (node:http, used by the Vite dev server). dev-runtime no longer exports port/clientUrl.
- Provider keys: @llmflow/providers/credentials PROVIDER_KEY_VARIABLES + providerApiKey(); GEMINI_API_KEY before GOOGLE_API_KEY. The GOOGLE-first variant lived in the provider health route that TASK-88 removed; OLLAMA_HOST/PORT are parsed only in ollama.ts. The proxy forwards client credentials and reads no keys itself. .env.example Gemini comment now states one rule.
- recipe-contracts 'Docker launcher' test: 1.2s alone but hit the default 5s timeout once under the full parallel suite; now 15s like the other subprocess tests.
- TASK-90: config is still read in server.ts (hosts/ports), proxy-server/proxy (PROXY_TIMEOUT_MS), otlp export, pricing, db — the config module should absorb these.
Validation: bun run check green; bun run test 225 pass/1 skip + dashboard 116 (new net, credentials, proxy-cors tests; dev-startup busy-port tests pass for backend and Vite); test:package passed (both tarballs); Playwright 125 passed; grep shows port parsing, loopback/wildcard lists, EADDRINUSE fallback, free-port and health polling each defined once.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Split the 851-line server.ts into an 80-line wiring module plus a routed JSON API (per-resource handlers), OTLP, static, live-update and proxy-server modules; passthrough routes now come from the handler map and every proxy response carries CORS headers. Port parsing, loopback rules, free-port and health polling live once in @llmflow/shared/net, busy-port fallback once in dev-runtime, and provider key precedence once in @llmflow/providers/credentials. Verified with new unit/integration tests, bun run check/test, test:package and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
