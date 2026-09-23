# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.
Layout: single-context.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the domain glossary.
- **ADRs**: Backlog docs under `adr/`, titled `ADR-NNNN: <title>`. List them with `backlog doc list --plain`
  and search with `backlog search "<topic>" --plain`; read the ones that touch the area you're about to
  work in with `backlog doc view <doc-id>`.
- **Backlog tasks** that own the area (`backlog search <topic> --plain`); they carry verified facts and
  decisions (see AGENTS.md).

If `CONTEXT.md` or any ADR doesn't exist yet, **proceed silently**. Don't flag their absence; don't
suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and
`/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## Writing them

- **`CONTEXT.md`** is an ordinary repository file; edit it directly. When it is first created, move the
  `## Vocabulary` section of `ARCHITECTURE.md` into it, leave a link in its place, and point the
  vocabulary reference in AGENTS.md at `CONTEXT.md`.
- **ADRs** are Backlog docs and change only through the CLI:
  `backlog doc create "ADR-NNNN: <title>" -t other -p adr --plain`, then
  `backlog doc update <doc-id> --content "<markdown>"`. Number them from `0001`. (Backlog's `decision`
  type is not used: its CLI cannot write a decision's body.)

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test
name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the
project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
