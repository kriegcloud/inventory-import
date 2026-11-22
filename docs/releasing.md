---
type: Tooling Guide
title: Releasing and deploying
description: How a change reaches people: work lands on main, which deploys staging; a release is a branch cut from main and a tag on it, which deploys production after Benjamin approves; a fix to a released version is cherry-picked from main and tagged with the next patch.
tags: [tooling, deploy, release]
---

# Releasing and deploying

Trunk, with release branches (Benjamin's decision "releases and deploys", in
`explorations/ideal-architecture/DECISIONS.md`). Work lands on `main` and nowhere else. `main` never deploys
production.

| What happens | What it deploys |
| --- | --- |
| A pull request is opened or pushed to | Its preview, `pr-<number>`, destroyed when it closes |
| A push to `main` passes CI, and that commit is still `main`'s head | The `staging` stage, at the commit CI checked |
| A tag `v<major>.<minor>.<patch>` is pushed on `release/<major>.<minor>` | Production, once the `production` environment's reviewer approves |

## The version

The app has one version, and a release tag is what says it. `bun run release` writes it into
`apps/inventory/package.json` and into `bun.lock`'s copy of it, on the release branch only: a release commit is never
on `main`, so `main`'s file keeps the version it had (0.6.1) and staging reports that. The packages are Turborepo's
Internal Packages: none is published, so none has a version of its own and Changesets is not used. It is added if a
package is ever published. The "(v0.6.1)" in `README.md` names the version that was submitted and never moves.

`CHANGELOG.md` is on release branches only, for the same reason. A new line's file starts from the last release's, so
it holds every release before its cut and its own; a patch made on an older line after that cut is in that line's
file and not in the newer one.

## Cutting a release

From `main`, clean and exactly where the remote's `main` is:

```bash
bun run release minor
```

`major` works the same way. It:

1. refuses a tree with changes;
2. fetches `main`, the release branches and the tags from `origin`, and stops if it cannot: "main" in every rule
   below is `origin/main`, never the `main` that happens to be here;
3. refuses a branch other than `main`, and a `main` that is ahead of or behind `origin/main`;
4. takes the next version after the highest anywhere (every `v*` tag and the app's own version);
5. runs `bun run check:full` on that commit, writing to the terminal as it runs, and makes nothing if it fails;
6. makes `release/<major>.<minor>` from `main` (or takes up one a stopped run left, if it is still where `main` is);
7. writes the version (the app's file and `bun.lock`'s copy), and the release notes at the top of `CHANGELOG.md`:
   the subjects of the commits the last release does not carry, grouped as Added (`feat`), Fixed (`fix`), and so
   on. Commits are compared by their change, so a fix a patch already released is not listed again;
8. commits `chore: release v<version>`, which changes those three files and nothing else, and makes an annotated
   tag holding the same notes.

The check runs before the release commit exists. That commit only moves the version and adds the notes, and CI checks
it on the release branch before the tag is pushed.

It pushes nothing. It prints the two commands:

```bash
git push origin release/0.7
```

```bash
git push origin v0.7.0
```

Push the branch first and wait for CI on it to pass, then push the tag. The tag starts the deploy workflow. Its first
job, "Check the release tag", runs `bun run beep release verify <tag>`, which holds the release command's rules again
on the tagged commit, against the remote's branches:

- the tag is annotated, and a version;
- its commit is on `origin/release/<major>.<minor>` and is not on `origin/main`;
- its commit is a release commit: one parent, the app's file there says the tag's version, and it changes only that
  file, `bun.lock` and `CHANGELOG.md`;
- what is under it landed on main: for `<major>.<minor>.0` its parent is a commit of `origin/main`; for a patch the
  release before it is under it, and every commit between is one whose change `origin/main` holds, and no merge.

A question git cannot answer (a branch that was not fetched) refuses the tag. A tag that fails stops there, before
anyone is asked to approve. Then production waits for Benjamin's approval in the `production` environment, and
deploys. Each tag waits in a group of its own, so a release that waits for its approval is never cancelled by a later
tag; two releases are not deployed at once because one person approves them.

What this guard cannot hold is itself: GitHub runs the workflow file and the command from the tagged commit, so a
commit that changes either is judged by its own copy. "What holds it" below says what stands behind it.

## A fix to a released version

1. Land the fix on `main`, as any change: a pull request, its check, its preview.
2. Cherry-pick it onto the release branch, keeping the trail: `git switch release/0.7`, then
   `git cherry-pick -x <commit>`.
3. On that branch: `bun run release patch`. It fetches as a cut does, and refuses:
   - a commit since the last tag whose change `origin/main` does not hold. `git cherry` compares each commit's
     change, so a cherry-pick that applied as it was counts. One whose conflict was resolved by hand differs from
     main's and is refused; whether such a fix may be released, and how it is shown, is an open decision of
     Benjamin's (asked 2026-11-22);
   - a merge commit, which `git cherry` never lists, so anything could ride in on one;
   - a branch here that does not hold the line's last release (a tag that was fetched, on a branch that was not
     pulled);
   - a branch on which nothing landed since the last tag, or that has never been tagged;
   - a version that would not go up: the app's file on the branch already says one at or above the next patch.

   It tags `v0.7.<n+1>` with notes from those commits, and prints the push commands.

A patch never goes the other way: nothing lands on a release branch first.

## What holds it

- **The release command's guards**, each with a test that fails without it
  (`packages/tooling/tool/cli/test/Release.test.ts`, on real git repositories with a remote): the refusals listed
  above, a tag only on a `release/*` branch whose major and minor are its own, nothing after a red check. A major or
  minor version cannot fail to go up, because it is worked out as the next above every release; the test shows that,
  and the refusal itself is shown for a patch.
- **The deploy guard**, `release verify`, with a test for each refusal in the same file, among them a tag made by
  hand on a commit `release` would not have made.
- **The deploy workflow** (`.github/workflows/deploy.yml`) starts production only on a `v*` tag, after its guard
  job. `test/DeployWorkflow.test.ts` in the same package parses the file and holds every job's event, environment,
  secrets and commands word for word, and runs its two shell guards. The workflow files are inputs of that test in
  `turbo.json`, so a change to one always runs it.
- **The repository's stack** (`packages/infra/src/GitHub.stack.ts`): only an admin may create, move or delete a `v*`
  tag, and a `release/*` branch is never force-pushed or deleted (admins may bypass both). The `production`
  environment requires Benjamin's approval.
- **CI runs on `release/**` too**, so a cherry-picked fix is checked on its branch before its tag is pushed.

**What GitHub itself does not hold yet.** The `production` environment names no branch or tag: Alchemy writes only
branch rules there and would delete a tag rule, and a branch rule refuses every tag. So GitHub will let any ref whose
workflow file names that environment ask for the approval, and the tag's guard is in the file the judged commit
brings. Until that is closed, the reviewer's approval is the one gate GitHub enforces: read which ref a run is for
before approving it. How to close it is an open decision of Benjamin's (asked 2026-11-22; the options are in
`goals/infra/PLAN.md`, step 12).

## Staging

`staging` is a rehearsal, like a preview. It is on `workers.dev`, has the two test organizations and the test
accounts, keeps sign-up closed, and has no model key. The rules answer, since decision I5 gives a key to production
only. Its test accounts take the one password the previews share. It runs on the previews' Cloudflare account, from
the `staging` environment, which only `main` may deploy to. Nobody deploys it until Benjamin has deployed the
repository's stack with the `staging` environment in it (`goals/infra/PLAN.md`, "What Benjamin does by hand").

It deploys only `main`'s head: a CI run that is run again for an older commit, or that finishes after a newer
commit's, deploys nothing, so staging never goes backwards. If the newest commit's CI fails, staging stays where it
was.

Its token is the previews' token. A Cloudflare token's Workers and D1 permissions cover a whole account, so every
preview job holds a token that can change or remove staging, and a pull request's run uses the pull request's own
copy of the workflow. The `staging` environment's "only main" rule therefore says which run may use that
environment, not who can reach staging: anyone who can push a branch to this repository can. Staging holds test
accounts only. Whether it gets an account of its own is an open decision of Benjamin's (asked 2026-11-22).
