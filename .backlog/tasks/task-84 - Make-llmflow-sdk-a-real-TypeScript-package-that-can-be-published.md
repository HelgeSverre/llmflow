---
id: TASK-84
title: Make llmflow-sdk a real TypeScript package that can be published
status: To Do
assignee: []
created_date: '2026-09-23 08:51'
updated_date: '2026-09-23 09:15'
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
- [ ] #1 packages/sdk builds ESM + declarations from TypeScript; typecheck covers it; hand-written index.d.ts is gone
- [ ] #2 `npm pack` in packages/sdk yields a tarball with LICENSE, README, dist and a correct exports map (types first, import, default); a consumer smoke test imports it
- [ ] #3 README documents every export incl. traced and has no require() example unless CJS is actually shipped
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-23 09:15
---
Reconciled with TASK-104: the SDK version moves in lockstep with the llmflow package in apps/server (the root has no version after 104), bumped together by just release (TASK-98).
---
<!-- COMMENTS:END -->
