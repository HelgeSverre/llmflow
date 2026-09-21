---
id: doc-4
title: Fix sequence — installation first
type: other
created_date: '2026-09-21 11:15'
updated_date: '2026-09-21 11:56'
---
**Completed locally on 2026-09-21.** All 22 tasks are Done. Validation: full server suite passed; 19 dashboard unit tests passed; 96 Playwright tests passed; workspace typecheck reported no errors/warnings; clean package smoke passed. Final targeted contract/shutdown regressions also passed after reliability changes. Screenshots are under .backlog/assets/images/fixed-*.png. No paid provider calls were needed.

Installation was also checked in an isolated source copy: Bun install/build, example-runner preflight, RAG SDK resolution and a complete RAG run against a local provider fixture. Real Claude Code/Aider accounts were not invoked. Implementation and verification are recorded in Git; no publication or push is implied by task completion.

[Timeline conversation](../assets/images/fixed-timeline-conversation.png) · [Session pagination](../assets/images/fixed-session-pagination.png) · [Replay result](../assets/images/fixed-replay-result.png)

The user requested installation and README fixes first because the documented first-run path is broken. This sequence supersedes the earlier eight-task queue in doc-2; its local-tool scope constraints still apply.

The latest review produced 14 new tasks (32–45) covering nine application findings and eight documentation groups, plus the noted architecture inaccuracies. Related installation failures, integration guides and Analytics response defects are grouped into cohesive fixes. Existing tasks 29–31 cover the earlier three correctness findings and are not duplicated. This was the approved 22-task queue; all 22 tasks are now Done.

Order below is the execution order. Ordinals are recorded on every open task; priority remains the issue severity. No dependency on an archived refactoring/security project has been added.

**1. Installation, examples and current documentation**

Restore a working first-run path before app changes. Fix scripts and imports alongside their READMEs; update llms.txt once those commands are verified. Finish the small guide/status corrections in this documentation pass.

- TASK-32: Repair installation quick starts and example endpoint defaults
- TASK-33: Repair the RAG example SDK import and setup
- TASK-34: Correct Aider and Claude Code integration instructions
- TASK-35: Bring llms.txt setup and source references into line with the app
- TASK-36: Remove unsupported Timeline capabilities from the AI CLI guide
- TASK-37: Mark implemented RFCs and correct obsolete architecture claims

**2. Broken screens and navigation**

Repair Analytics field contracts/render errors, then session-to-trace selection. These are immediately visible failures in existing features.

- TASK-38: Repair Analytics response contracts and render real totals
- TASK-39: Open the selected trace when navigating from Sessions

**3. Correct stored and displayed data**

Preserve direct-ingest correlation and unknown timing first. Align zero display, metric filtering and gauge aggregation, then wire live metrics to the corrected list/summary paths.

- TASK-43: Preserve session and conversation metadata from direct span ingestion
- TASK-44: Preserve unknown OTLP duration instead of inventing zero
- TASK-45: Show valid zero aggregates in the dashboard header
- TASK-29: Make metric summary cards obey the selected filters
- TASK-30: Show correct gauge averages regardless of integer or decimal encoding
- TASK-40: Update the Metrics view when live metric events arrive

**4. Reach and filter existing records**

Fix timeline related-log correlation, allow actual service names, and make sessions beyond the first 50 reachable.

- TASK-31: Show related logs for timeline traces with distinct span and trace IDs
- TASK-42: Filter Timeline by actual captured service names
- TASK-41: Make sessions beyond the first page accessible

**5. Readable trace inspection**

Build readable timeline detail and conversation/tool-call views once underlying data and navigation are dependable.

- TASK-24: Make timeline trace and log details readable
- TASK-25: Show captured LLM conversations as readable messages and tool calls

**6. Reliability and optional replay**

Bound tool capture and flush final export batches. Keep request replay last as an optional new feature after broken existing behavior is repaired.

- TASK-1: Bound capture memory for tool-heavy streaming responses
- TASK-9: Flush queued OTLP exports when stopping the local server
- TASK-20: Replay a captured request from trace detail

**Verification along the way**

For the first batch, follow the documented Bun installation/start flow in an isolated checkout/database, exercise the actual example-runner preflight, resolve the RAG SDK import, and check integration routes with local upstream fixtures. Preserve proxy 8080 versus dashboard/OTLP 1337. Do not require paid provider calls just to establish that installation and route wiring work. Clearly state any external-client prerequisites that cannot be exercised locally.

For app fixes, use focused API/browser regressions that assert real values, selected records and page errors. Seed distinct span/trace/session IDs, integer/double/zero/missing measurements, live arrivals and more than 50 sessions where relevant. Rebuild the dashboard after code changes. Run the relevant checks per fix, then the full server/dashboard/Playwright suite and package smoke check after the combined changes; avoid repeating all checks for prose-only edits.

All tasks in this sequence are implemented and their acceptance criteria are checked. The sequence below is retained as the execution record, not an open queue.

**Product constraints**

This remains an intentionally local, easy-to-use tool. No auth setup, security-hardening project, migration reshuffle, arbitrary file-size target or blanket test-organization project is a prerequisite. Refactor only where it directly simplifies a concrete fix. Preserve the user-visible data needed for debugging.

**Finding coverage**

- Review application 1–2 → 38; 3 → 39; 4 → 40; 5 → 41; 6 → 42; 7 → 43; 8 → 44; 9 → 45.
- Review documentation 1–2 → 32; 3 → 33; 4–5 → 34; 6 → 35; 7 → 36; 8 plus secondary architecture inaccuracies → 37.
- Existing metric filters/gauge averages/timeline correlation → 29/30/31.

The complete review evidence is retained in doc-3, including browser screenshots under .backlog/assets/images.
