---
id: TASK-43
title: Preserve session and conversation metadata from direct span ingestion
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 11:17'
updated_date: '2026-09-21 11:48'
labels:
  - bug
  - ingestion
dependencies: []
references:
  - apps/server/src/server.ts
  - packages/db/src/index.ts
  - packages/otlp/src/traces.js
documentation:
  - .backlog/docs/doc-4 - Fix-sequence-—-installation-first.md
priority: medium
ordinal: 900
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The direct /api/spans route drops session_id, conversation_id and agent_name when building the DB row. The schema and OTLP path support these fields. A successful POST with session_id was absent from /api/sessions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Direct span ingestion persists the supported optional session_id, conversation_id and agent_name fields.
- [x] #2 The resulting span appears in the matching session and relevant correlation filters; requests omitting these fields still work.
- [x] #3 An endpoint regression verifies the persisted/API values and session listing after a direct POST, using distinct row and trace IDs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Preserve the actual API/database values through the relevant boundary; add focused ingestion and browser assertions for correlation, missing timing and real zeros.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution sequence: 3. Correct stored and displayed data; overall position 9. See doc-4. This is scheduling order, not an artificial implementation dependency.

Direct span ingestion preserves session_id, conversation_id and agent_name. Backend regression verifies persistence, session grouping and correlation filters without changing existing callers.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Direct span ingestion preserves session_id, conversation_id and agent_name. Backend regression verifies persistence, session grouping and correlation filters without changing existing callers.

Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
