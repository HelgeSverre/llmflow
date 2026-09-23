---
id: TASK-84
title: Make llmflow-sdk a real TypeScript package that can be published
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 18:16'
labels:
  - typescript
  - packaging
  - sdk
milestone: m-0
dependencies:
  - TASK-77
references:
  - packages/sdk/package.json
  - packages/sdk/index.js
  - packages/sdk/README.md
priority: medium
type: task
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision: publish it properly. Today `packages/sdk` (190 LOC JS, hand-written `index.d.ts`, v0.2.2) is documented as `npm install llmflow-sdk` in its README, `AGENTS.md:30`, `examples/README.md:86`, `website/llms.txt:34` but `npm view llmflow-sdk` is 404. `exports` has only `import` then `types` (`package.json:11-12`): no `default`/`require` condition, so the README's `require('llmflow-sdk')` examples (:19, :138) throw ERR_PACKAGE_PATH_NOT_EXPORTED. No LICENSE in the package, no typecheck, no build. `traced` (`index.js:131`) is undocumented. `examples/rag-pipeline/index.js:26` imports it by relative path.
Port to `src/index.ts`, build `dist/` (ESM + .d.ts, optionally CJS) with `bun build`/tsc on `prepack`, `files` whitelist, LICENSE, version tied to the root version (bumped together by the release recipe), README rewritten from the real API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 packages/sdk builds ESM + declarations from TypeScript; typecheck covers it; hand-written index.d.ts is gone
- [x] #2 `npm pack` in packages/sdk yields a tarball with LICENSE, README, dist and a correct exports map (types first, import, default); a consumer smoke test imports it
- [x] #3 README documents every export incl. traced and has no require() example unless CJS is actually shipped
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Port to src/index.ts with exported types; traced supports both decorator styles. 2. tsc build (tsconfig.build.json) to dist on prepack; exports types/import/default; files whitelist; LICENSE copied on prepack. 3. Version 0.4.1 = apps/server. 4. Unit tests + tarball smoke test (Node import, span delivery, NodeNext types) wired into test:package. 5. README from the real API.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified facts and decisions:
- ESM only; no CJS build. README says so and tells CJS users to use await import('llmflow-sdk'). No require() examples remain.
- Build: 'bun run build' in packages/sdk = rm -rf dist && tsc -p tsconfig.build.json (declarations on, source/declaration maps off, *.test.ts excluded). prepack builds and copies ../../LICENSE; postpack removes it. packages/*/dist/ is gitignored.
- Tarball contents are exactly LICENSE, README.md, dist/index.d.ts, dist/index.js, package.json; exports['.'] = { types, import, default } in that order; no workspace:/catalog: specifiers after bun pm pack.
- Version 0.4.1 (same as apps/server). TASK-98 release recipe must bump both together.
- API: generateId, getCurrentSpan, currentTraceHeaders, span (options or type,name,fn; fn may be sync), trace, traced, wrapOpenAI; types SpanOptions, SpanContext, SpanType, TraceHeaders, TracedDecorator. The undocumented span option alias service_name is gone (serviceName only).
- traced(type, name?) now works as a TC39 decorator (method, context) as well as a legacy experimentalDecorators one; before it only worked with experimentalDecorators.
- scripts/test-sdk-package.ts: bun pm pack -> npm install --offline into a clean dir -> node imports all exports and sends two spans to a local collector -> tsc with NodeNext resolves the types. Root 'bun run test:package' now runs test-package.ts && test-sdk-package.ts.
- apps/server/test/sdk-endpoint.test.ts imports packages/sdk/src/index.ts. env-example.test.ts skips packages/sdk (its LLMFLOW_URL/LLMFLOW_DEBUG belong to the user's app and are documented in the SDK README).
- Not done here: examples/rag-pipeline still imports ../../packages/sdk/index.js (now gone) — TASK-100 must switch it to llmflow-sdk. Publishing itself is TASK-98 (release nothing now).
Validation: bun run check green (sdk typechecked); bun run test 222 pass/1 skip + dashboard 116; SDK unit tests 6 pass; bun run test:package passed for both tarballs.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Reconciled with TASK-104: the SDK version moves in lockstep with the llmflow package in apps/server (the root has no version after 104), bumped together by just release (TASK-98).
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported llmflow-sdk to TypeScript with a tsc ESM + declarations build, a types/import/default exports map, a files whitelist with LICENSE, lockstep version 0.4.1, decorator support for both styles, and a README written from the real API. Verified with SDK unit tests, a tarball smoke test (Node import, span delivery, NodeNext types) now part of test:package, and bun run check/test.
<!-- SECTION:FINAL_SUMMARY:END -->
