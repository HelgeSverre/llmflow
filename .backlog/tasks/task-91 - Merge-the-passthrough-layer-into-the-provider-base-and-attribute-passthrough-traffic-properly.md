---
id: TASK-91
title: >-
  Merge the passthrough layer into the provider base and attribute passthrough
  traffic properly
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 08:52'
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
- [ ] #1 One provider abstraction serves both translated and passthrough requests; cloned types and no-op overrides are gone; one shared key-extraction helper
- [ ] #2 Passthrough and proxied requests to the same upstream share a provider value and passthrough rows carry a service_name; Analytics shows one bucket per provider
- [ ] #3 Cache-token capture is identical for Anthropic in both modes (test)
<!-- AC:END -->
