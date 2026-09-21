---
id: doc-2
title: Product scope and focused backlog
type: other
created_date: '2026-09-21 09:54'
updated_date: '2026-09-21 11:18'
---
> Scope guidance remains current. The eight-task list below is the earlier pruning snapshot; the new review findings and installation-first execution order are in [Fix sequence](doc-4%20-%20Fix-sequence-—-installation-first.md).

This decision supersedes the active-task recommendations in doc-1, which records the earlier implementation audit. The user explicitly set the product scope during the subsequent 2026-09-21 pruning pass.

## Product scope

LLMFlow is an intentionally local debugging tool. Prioritize accurate data, readable traces, dependable capture and low-friction debugging. Do not add login, bearer-token setup or a general security-hardening roadmap. Revisit security only for a clearly demonstrated, plainly wrong behavior in the intended local workflow.

A task needs a concrete user problem and observable improvement. Moving files, line-count targets, migration-interface symmetry, reorganizing tests and speculative infrastructure are not standalone product goals. Refactor when it makes a real fix simpler. Add regression tests for that fix rather than creating blanket coverage projects.

Retain straightforward local defaults already implemented. Standard OTLP integrations and the existing installation path are sufficient until a concrete user workflow demonstrates a gap. Performance work requires a reproducible slow workload before choosing FTS, scheduling or other machinery.

## Queue after initial pruning: eight tasks (historical)

| Priority | Task | User benefit |
| --- | --- | --- |
| High | 29 — Filter metric cards with the table | Selecting a service/type/name no longer leaves unrelated summary values. |
| High | 30 — Correct gauge averages | Integer and decimal encodings of the same readings produce the same statistic. |
| High | 31 — Correlate timeline logs by trace ID | Existing related logs appear for normal OTLP spans. |
| High | 24 — Readable timeline details | Inspect relevant fields without digging through a full JSON dump. |
| High | 25 — Readable conversations/tool calls | Follow what the model saw, returned and called. |
| Medium | 1 — Bound aggregate tool capture | Tool-heavy streams cannot accumulate unlimited captured tool metadata; forwarding stays intact. |
| Medium | 9 — Flush exports on Ctrl+C | The last queued export batch is not simply abandoned when stopping the local server. |
| Low | 20 — Simple replay | Rerun a captured request using existing provider configuration and open the result. |

Tasks 29–31 are new source-confirmed correctness findings, recorded for implementation; they were not fixed in this pruning pass. Task 1 keeps only its unfinished concrete memory issue. Task 9 no longer prescribes an elaborate shutdown coordinator/checkpoint sequence. Task 20 no longer requires side-by-side diff UI, a particular database column or a migration-runner rewrite.

## Archived from the active queue

- 3, 5: speculative retention/FTS optimization without a measured user-visible performance problem.
- 4: blanket configurable body caps; capture truncation can remove the data a debugging tool exists to show. Concrete tool-capture memory work remains in task 1.
- 6, 15: bearer-auth implementation and its documentation, contrary to the intended frictionless local workflow.
- 8, 12: migration reshuffling and file-splitting/line-count goals without a demonstrated failure.
- 13: extra heartbeat/deadline/observability machinery without a demonstrated local connection problem.
- 14: package-local test organization and generic coverage/runtime targets. Focused regression testing remains part of actual fixes.
- 17, 18, 19: speculative extra SDKs and Homebrew distribution; revisit only for a concrete integration/install blocker.
- 21: scheduled budget alerts/webhooks and persisted deduplication are outside this local debugging scope.

These thirteen tasks were archived with individual reasons, not marked completed. Finished tasks remain as historical records. Active dependencies on archived projects were removed. README and ARCHITECTURE no longer promise an auth/heartbeat roadmap.

