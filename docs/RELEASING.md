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

### Why the publish is not in `publish.yml`

A release created with `GITHUB_TOKEN` **does not trigger further workflow
runs** — GitHub blocks that to prevent recursion. `publish.yml` fires on
`release: published`, so it would never run for an automated release: you would
get GitHub Releases that silently never reach npm, with every check green.

So `release.yml` publishes inline. `publish.yml` remains for releases a human
creates manually. The two cannot double-publish, precisely because of the rule
above.

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
| `docs:`, `build:` | patch (shown in changelog) |
| `ci:`, `chore:`, `refactor:`, `test:` | no release |

Dependabot is configured in `.github/dependabot.yml` to use these prefixes —
`fix` for production dependencies (so a security bump ships a patch release),
`chore` for dev dependencies, `ci` for actions, `build` for Docker base images.
Without that, its default `Bump X from A to B` is not a Conventional Commit and
Release Please ignores it entirely, meaning **security updates would never cut
a release**.

## Prerequisites (already configured)

- Settings → Actions → General → **Allow GitHub Actions to create and approve
  pull requests** must be on, or Release Please cannot open the release PR.
- npm publishing uses OIDC trusted publishing — there is no npm token stored.
- `.release-please-manifest.json` must track the currently published version,
  or the first release will collide with an existing npm version and fail.
