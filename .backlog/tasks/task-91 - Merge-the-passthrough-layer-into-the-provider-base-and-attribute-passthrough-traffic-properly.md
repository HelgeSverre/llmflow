---
id: TASK-91
title: >-
  Merge the passthrough layer into the provider base and attribute passthrough
  traffic properly
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 18:58'
labels:
  - refactor
  - providers
milestone: m-0
dependencies:
  - TASK-77
  - TASK-88
references:
  - packages/providers/src/passthrough.ts
  - packages/providers/src/base.ts
  - apps/server/src/proxy.ts
priority: medium
type: task
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`PassthroughHandler` (`packages/providers/src/passthrough.ts:50-57, 122-126`) re-implements `BaseProvider` (`base.ts:57-64, 126-130`); the `Passthrough*` types copy `ProviderTarget/TokenUsage/ProviderRequest`; every call passes through two layers for hook options nobody passes; `OpenAIPassthrough` overrides (294-321) equal the defaults; Helicone host resolved twice (333, 340). API-key/Bearer extraction exists 5× with different behaviour (`anthropic.ts:55-72`, `azure.ts:94-109`, `passthrough.ts:146-165`, `:235-243`, `gemini.ts:66-79`). Azure `transformRequestBody` (111) is a no-op and its `extractUsage` equals base; `OpenAIProvider.getTarget/transformRequestHeaders` equal `OpenAICompatibleProvider`. Anthropic cache tokens are kept by passthrough (170-185) but dropped by `AnthropicProvider.extractUsage` (247-257).
Attribution: passthrough traces get no `service_name` (`proxy.ts:143-160`) so they show as "unknown" in Analytics and vanish from a service-filtered Timeline; provider is stored as `'anthropic-passthrough'` vs `'anthropic'`, splitting one upstream into two buckets. One concept has five names (passthrough.ts / PassthroughHandler / passthroughHandlers / `native` / "native mode" in docs).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One provider abstraction serves both translated and passthrough requests; cloned types and no-op overrides are gone; one shared key-extraction helper
- [x] #2 Passthrough and proxied requests to the same upstream share a provider value and passthrough rows carry a service_name; Analytics shows one bucket per provider
- [x] #3 Cache-token capture is identical for Anthropic in both modes (test)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. BaseProvider gains passthroughTarget, shared headers/usage/responseModel/streaming; delete PassthroughHandler + *Passthrough; passthrough routes reuse registry providers + HeliconeProvider. 2. apiKeyFrom helper. 3. Remove duplicated/no-op overrides (OpenAI extends OpenAICompatible; Azure; Ollama). 4. Proxy: one path, usage/model from raw response, provider name shared, service_name on every row. 5. Tests incl. both-mode cache tokens; live tests; gate; Playwright.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- One abstraction: BaseProvider (packages/providers/src/base.ts) has name/displayName/hostname/port/protocol fields; getTarget (translated; defaults to passthroughTarget), passthroughTarget (same host, client path), transformRequestHeaders (both modes), transformRequestBody/normalizeResponse (translated only), extractUsage(raw body) and responseModel(raw body, req) (both modes), requestedModel/identifyRequestModel, isStreamingRequest, createStreamSession.
- packages/providers/src/passthrough.ts and the ./passthrough export are deleted. index.ts exports passthroughProviders { anthropic, gemini, openai } = registry.get(...) instances + helicone: new HeliconeProvider() (helicone.ts, passthrough only). registry.get(prefix) added ('openai' returns the default provider).
- apiKeyFrom(headers, ...names) in base.ts replaces the five variants (Anthropic x-api-key, Azure api-key, Gemini x-goog-api-key, plus Bearer stripping, case-insensitive).
- Behaviour changes: Anthropic forwards a client's anthropic-version (default 2023-06-01) and anthropic-beta in translated mode too. Gemini never forwards Authorization upstream (the key always goes into ?key=); before, translated mode forwarded a non-Bearer Authorization. Anthropic extractUsage keeps cache_creation/read_input_tokens when present (passthrough used to write 0 when absent).
- Removed duplicates: OpenAIProvider extends OpenAICompatibleProvider (identical target/headers; base usage already reads input_tokens); Azure transformRequestBody/normalizeResponse/extractUsage; Ollama getTarget; Cohere/Anthropic getTarget reuse passthroughTarget.
- Proxy (apps/server/src/proxy.ts): forwardProxyRequest(req, url, passthrough?: { provider, prefix }). Usage and model always come from the provider's raw response (extractUsage/responseModel); the translated path only normalizes the body returned to the client. Every proxied span gets provider = the upstream provider name (anthropic, not anthropic-passthrough) and service_name = X-LLMFlow-Service header or 'llmflow-proxy' (before: null in both modes, shown as 'unknown').
- Naming: 'passthrough' everywhere (proxy param, passthroughProviders, README); 'native' now only describes a provider's own request format.
- Tests: packages/providers/src/passthrough.test.ts rewritten for passthrough mode on the real providers (all old assertions kept); proxy-regressions fixtures are the real providers pointed at the local upstream; new proxy-regressions test asserts provider, service_name and cache counters are identical for translated vs passthrough Anthropic, streaming and non-streaming. reviewed-fixes and live passthrough tests expect the unified names.
- README 'Supported Providers' documents passthrough routes and the X-LLMFlow-Service / X-LLMFlow-Tags / X-Trace-Id / X-Parent-Id headers.
- For TASK-94 (naming): the default service name for proxied spans is 'llmflow-proxy'; OTLP ingestion defaults to 'unknown'.
Validation: bun run check green; bun run test 226 pass/1 skip + dashboard 116; test:live 12 pass (Anthropic/OpenAI translated + passthrough under the unified names; Gemini still 402 billing); test:package passed; Playwright 125 passed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Reconciled with TASK-90: providers read Azure/Ollama/Helicone settings through the shared config module instead of ad-hoc process.env; deleting the never-passed constructor options is compatible with that (config is imported, not injected).
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Folded the passthrough layer into BaseProvider so one provider class serves translated and passthrough requests, replaced five API-key extraction variants with one helper, removed duplicated and no-op overrides, and made the proxy record the same provider name, a service_name, and identical Anthropic cache-token usage in both modes. Verified with rewritten provider tests, a new both-modes proxy regression test, live provider tests, bun run check/test, test:package and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
