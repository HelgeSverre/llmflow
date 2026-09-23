# Issue tracker: Backlog.md

Work for this repo is tracked in Backlog.md (`.backlog/`). Create and change tasks, docs and milestones
only through the `backlog` CLI; never edit their markdown files (see AGENTS.md). Before a lifecycle step,
read the matching guide: `backlog instructions task-creation`, `task-execution` or `task-finalization`.

| Skill concept    | In Backlog.md                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec             | A doc: `backlog doc create "<Feature> spec" -t specification -p specs --plain`, then `backlog doc update <doc-id> --content "<markdown>"`         |
| Ticket / issue   | A task: `backlog task create "<title>" -d "<body>" --ac "<criterion>" -l <labels> --dep TASK-a,TASK-b --ref <doc-id> --plain`                     |
| Blocking edge    | `--dep` on the task. On `task edit`, `--dep` **replaces** the whole list: pass every dependency                                                   |
| Feature grouping | A milestone (`-m <milestone>`) or a parent task (`-p TASK-N`)                                                                                     |
| Triage state     | Labels (see `triage-labels.md`): `backlog task edit N --add-label <label> --remove-label <label>`                                                 |
| Comment          | `backlog task edit N --append-notes "<text>"`                                                                                                     |
| Close            | `backlog task edit N -s Done --final-summary "<text>"`; wontfix: add the `wontfix` label, give the reason in notes, then `backlog task archive N` |

## When a skill says "publish to the issue tracker"

Create a task (or, for a spec, a doc) with the CLI and report its ID.

## When a skill says "fetch the relevant ticket"

`backlog task <id> --plain` for a task, `backlog doc view <doc-id>` for a doc. Search with
`backlog search "<topic>" --plain`.

## Picking up work

Ready work is `backlog task list -s "To Do" -l ready-for-agent --plain`. A task is unblocked when every
task in its dependencies is Done. Claim it with `backlog task edit N -s "In Progress" -a @claude`.

## Wayfinding operations

Used by `/wayfinder`.

- **Map**: a doc, `backlog doc create "<effort> map" -p maps`, whose body (Notes / Decisions so far /
  Fog) is written with `backlog doc update <doc-id> --content`.
- **Child ticket**: a task labelled `wayfinder:<effort>` plus its type (`research`, `prototype`,
  `grilling` or `task`), with `--ref <map doc-id>` and the question in the description.
- **Blocking**: `--dep` between child tasks.
- **Frontier**: `backlog task list -s "To Do" -l wayfinder:<effort> --plain`; the unblocked task with
  the lowest ID wins.
- **Claim**: `-s "In Progress" -a @claude` before any work.
- **Resolve**: `--append-notes` with an `## Answer` section, `-s Done`, then add a pointer (gist and task
  ID) to the map's Decisions so far by rewriting the map doc with `backlog doc update --content`.
