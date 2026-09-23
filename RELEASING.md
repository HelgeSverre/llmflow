# Releasing

A release publishes two npm packages built from this repository, `llmflow` (`apps/server`) and
`llmflow-sdk` (`packages/sdk`), plus the `helgesverre/llmflow` Docker image, and creates a GitHub
Release. Both packages always carry the same version.

## Flow

1. Make sure `release-notes/UNRELEASED.md` lists the user-visible changes (everyone adds to it as
   they go; see `AGENTS.md`).
2. On an up-to-date `main` with a clean working tree, preview and then cut the release:

   ```bash
   just release 0.5.0 --dry-run   # shows what will change; changes nothing
   just release 0.5.0
   ```

   This bumps `apps/server/package.json` and `packages/sdk/package.json` to 0.5.0, updates
   `bun.lock`, turns `release-notes/UNRELEASED.md` into `release-notes/v0.5.0.md` and resets it,
   commits `Release v0.5.0` and creates the annotated tag `v0.5.0`. It does not push. It refuses to
   run off `main`, with uncommitted changes, with an empty `UNRELEASED.md`, or for a version that is
   not newer than the current one.

3. Push the commit and the tag:

   ```bash
   git push origin main v0.5.0
   ```

4. The tag starts [`.github/workflows/release.yml`](.github/workflows/release.yml):
   - **prepare** checks that the tag matches both `package.json` versions and that the notes file
     exists;
   - **checks** runs the full CI suite (`checks.yml`);
   - **npm** packs each package in its workspace directory with `bun pm pack` (which runs
     `prepack` and rewrites `workspace:`/`catalog:` specifiers) and publishes the tarballs with
     `npm publish --provenance --access public`;
   - **docker** builds `linux/amd64` and `linux/arm64` and pushes `helgesverre/llmflow:0.5.0` and
     `:latest`;
   - **github-release** creates the `v0.5.0` release from `release-notes/v0.5.0.md` and marks it
     Latest.

   Nothing is published unless the checks pass. If a job fails after npm has published, fix the
   cause and re-run the failed jobs from the Actions page; npm versions cannot be republished.

## Rehearsing

Run the workflow by hand (Actions → Release → Run workflow). With `dry_run` on (the default) it
runs the checks, packs both packages, runs `npm publish --dry-run` and builds the multi-arch
image without pushing, and skips the GitHub Release. The version defaults to the current
`package.json` version.

## Required secrets

Set these in the repository settings (Settings → Secrets and variables → Actions):

| Secret               | Used by | Value                                                                    |
| -------------------- | ------- | ------------------------------------------------------------------------ |
| `NPM_TOKEN`          | npm     | npm automation token with publish rights for `llmflow` and `llmflow-sdk` |
| `DOCKERHUB_USERNAME` | docker  | Docker Hub user that can push `helgesverre/llmflow`                      |
| `DOCKERHUB_TOKEN`    | docker  | Docker Hub access token for that user                                    |

Provenance uses the workflow's OIDC token (`id-token: write`); both `package.json` files carry a
`repository` field pointing at `github.com/HelgeSverre/llmflow`, which npm requires for it.

## First release after the 2026 cleanup

Published artifacts drifted before this flow existed: npm has 0.3.1, 0.3.2 and 0.4.1; git tags stop
at v0.3.2; GitHub's Latest release is v0.2.2; Docker tags mix `0.4.1` and `v0.3.2`; and
`release-notes/v0.4.0.md` was never published. Version 0.4.1 is taken on npm, so the next release
is 0.4.2 or later (0.5.0 fits the breaking API renames in `UNRELEASED.md`). After it, confirm:

- `npm view llmflow version` and `npm view llmflow-sdk version` show the new version, and the
  README screenshot renders on npmjs.com;
- `docker run -p 127.0.0.1:1337:1337 helgesverre/llmflow:latest` answers on
  `http://127.0.0.1:1337/api/health`;
- the GitHub release for the new tag is marked Latest.
