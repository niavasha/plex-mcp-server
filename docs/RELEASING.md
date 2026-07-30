# Releasing

Releases are automated. A release is **the act of merging the release PR** —
there is nothing to cut by hand.

## How it works

1. Commits land on `main` using [Conventional Commits](https://www.conventionalcommits.org/).
2. On every push to `main`, `.github/workflows/release.yml` runs Release Please,
   which accumulates those commits into a release PR titled
   `chore(main): release X.Y.Z`. That PR bumps `package.json`,
   `package-lock.json` and `.release-please-manifest.json`, and regenerates
   `CHANGELOG.md`.
3. Merging the release PR creates the tag and the GitHub Release, then builds,
   tests, audits and publishes to npm — all inside the same workflow run.

Nothing reaches npm until you merge that PR, so the version and changelog are
always reviewable first.

### How the publish actually happens

`publish.yml` is the **only** workflow that publishes to npm. That is not
stylistic: npm's OIDC trusted publishing is bound to a specific workflow
*filename*, so publishing from any other file is rejected with
`E404 ... you do not have permission` — even though the OIDC token is valid and
the provenance statement signs successfully. The 404 (rather than a 403) makes
it read like a missing package.

This bit for real: 1.3.0 was published from `release.yml`, got tagged and
released on GitHub, and never reached npm.

So `release.yml` **dispatches** `publish.yml` instead of publishing itself. It
has to be a dispatch rather than relying on the `release: published` event,
because a release created with `GITHUB_TOKEN` does not raise an event that
starts workflows — but `workflow_dispatch` is explicitly exempt from that rule.

`publish.yml` skips the publish if the version is already on npm, so a repeated
dispatch is harmless rather than a hard error.

### Provenance names the ref you dispatch from

The dispatch targets the **tag**, not `main`. GitHub's OIDC claims describe the
ref the workflow was taken from, and those claims become the SLSA provenance
attached to the npm package. Dispatching from `main` makes the package attest
`refs/heads/main` at whatever commit `main` happens to be — even though the job
checks out the tag — so the signature names a different source commit than the
artifact was actually built from.

1.3.0 shipped with exactly that flaw: its provenance records
`refs/heads/main@5314758` while the tag is `5deacd4`. Fixed from 1.3.1 onward.
Because the dispatch now targets the tag, the tag must contain a `publish.yml`
with a `workflow_dispatch` trigger — true for every tag cut after that change.

**If you ever move the publish to a different workflow file, update the trusted
publisher on npmjs.com to match, or releases will silently stop reaching npm.**

## Merge strategy — this matters

| PR source | Strategy | Why |
|---|---|---|
| Outside contributor | **Merge commit** | Preserves their commits' authorship. GitHub's contributors graph is built from the commit *author* field, so squashing erases them from it — and a `Co-authored-by` trailer does **not** put them back (verified: a co-author-only contributor does not appear in the contributors API). |
| Dependabot | **Squash** (automated) | A bot has no authorship to preserve, and squashing avoids duplicate changelog entries. |
| Your own branches | Either | Squash if the intermediate commits aren't interesting. |

### Avoiding duplicate changelog entries

Release Please reads **both** the commits inside a PR and the PR title it
associates with the merge commit. So when a PR is merged with a merge commit
and its title carries a Conventional Commit prefix, the change is counted
twice.

**When merging a contributor PR with a merge commit, give the PR a plain
title** — `Add get_active_sessions and multi-session HTTP transport`, not
`feat: add get_active_sessions ...`. The individual commits supply the
changelog entries; the PR title should not compete with them.

**Do not hand-edit the release PR to fix a duplicate.** Release Please
regenerates that branch from scratch on *every* push to `main`, so your edit
survives only until the next merge — and it will look like it worked right up
until it silently doesn't. (Confirmed the hard way while setting this up: an
edit to the 1.3.0 changelog was wiped by the very next merge to `main`.)

If a bad entry reaches a release, fix it in a normal `docs:` commit on `main`
*after* the release lands. Release Please only regenerates the pending section;
sections for versions already released are left alone, so the correction is
permanent.

## Version bumping

Release Please decides the bump from the commit types since the last release:

| Commit | Bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` / `BREAKING CHANGE:` footer | major |
| `docs:`, `build:` | **no bump** — appears in the changelog of the next release, but does not cause one |
| `ci:`, `chore:`, `refactor:`, `test:` | no bump, hidden from the changelog |

Only `feat`, `fix` and breaking changes move the version. `changelog-sections`
in `release-please-config.json` controls **visibility only** — marking a type
visible does not make it releasable. If the only commits since the last release
are `docs`/`build`/`ci`/`chore`, no release PR is opened at all.

Dependabot is configured in `.github/dependabot.yml` to use these prefixes.
Without that, its default `Bump X from A to B` is not a Conventional Commit at
all and Release Please ignores it entirely — meaning **security updates would
never cut a release**.

| Ecosystem | Prefix | Result | Why |
|---|---|---|---|
| npm, production | `fix` | **patch release** | Ships in the published package, so consumers need a version |
| npm, development | `chore` | no release | Not in the published tarball |
| github-actions | `ci` | no release | Affects the build, not the artefact |
| docker | `build` | no release | The base image is not part of the npm package, and no image is published to a registry |

Dependency updates should therefore only ever produce **patch** releases, never
minor ones — a dependency bump does not change *this* package's public API. A
minor bump means a `feat` landed.

**Caveat on the Docker row:** if this project ever starts publishing a container
image, a base-image CVE fix would need to ship, and `build` would have to become
`fix`. As things stand nothing is published from the Dockerfile, so a bump there
correctly releases nothing.

## Prerequisites (already configured)

- Settings → Actions → General → **Allow GitHub Actions to create and approve
  pull requests** must be on, or Release Please cannot open the release PR.
- npm publishing uses OIDC trusted publishing — there is no npm token stored.
- `.release-please-manifest.json` must track the currently published version,
  or the first release will collide with an existing npm version and fail.
