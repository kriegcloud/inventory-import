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
| A push to `main` passes CI | The `staging` stage, at the commit CI checked |
| A tag `v<major>.<minor>.<patch>` is pushed on `release/<major>.<minor>` | Production, once the `production` environment's reviewer approves |

## The version

The app has one version, in `apps/inventory/package.json`. The packages are Turborepo's Internal Packages: none is
published, so none has a version of its own and Changesets is not used. It is added if a package is ever published.
The "(v0.6.1)" in `README.md` names the version that was submitted and never moves.

## Cutting a release

From `main`, clean and up to date:

```bash
bun run release minor
```

`major` works the same way. It:

1. refuses a tree with changes, or a branch other than `main`;
2. takes the next version after the highest anywhere (every `v*` tag and the app's own version);
3. runs `bun run check:full` on that tree, and makes nothing if it fails;
4. makes `release/<major>.<minor>` from `main` (or takes up one a stopped run left, if it is still where `main` is);
5. writes the version, and the release notes into `CHANGELOG.md`: the subjects of the conventional commits since
   the last release, grouped as Added (`feat`), Fixed (`fix`), and so on;
6. commits `chore: release v<version>` and makes an annotated tag holding the same notes.

It pushes nothing. It prints the two commands:

```bash
git push origin release/0.7
```

```bash
git push origin v0.7.0
```

Push the branch first and wait for CI on it to pass, then push the tag. The tag starts the deploy workflow. Its first
job, "Check the release tag", runs `bun run beep release verify <tag>`. Anything else stops there, before anyone is
asked to approve. Only an annotated `v*` tag whose commit is on `origin/release/<major>.<minor>` passes, and that commit
must not be on `main`. Then production waits for Benjamin's approval in the `production` environment, and deploys.

## A fix to a released version

1. Land the fix on `main`, as any change: a pull request, its check, its preview.
2. Cherry-pick it onto the release branch, keeping the trail: `git switch release/0.7`, then
   `git cherry-pick -x <commit>`.
3. On that branch: `bun run release patch`. It refuses if a commit since the last tag on that branch has no
   counterpart on `main`. It compares each commit's change with `git cherry`, so a cherry-pick counts. It also refuses
   when nothing landed since the last tag, or when the branch has never been tagged. It tags `v0.7.<n+1>` with notes
   from those commits, and prints the push commands.

A patch never goes the other way: nothing lands on a release branch first.

## What holds it

- **The release command's guards**, each with a test (`packages/tooling/tool/cli/test/Release.test.ts`): a tag only
  on a `release/*` branch whose major and minor are its own; a version only goes up; nothing on a dirty tree or after
  a red check; a patch only of commits already on `main`.
- **The deploy workflow** (`.github/workflows/deploy.yml`) starts production only on a `v*` tag. Its guard job refuses
  a tag that is not annotated, is not on its release branch, or is on a commit `main` holds. Its routing is held by
  `test/DeployWorkflow.test.ts` in the same package.
- **The repository's stack** (`packages/infra/src/GitHub.stack.ts`): only an admin may create, move or delete a `v*`
  tag, and a `release/*` branch is never force-pushed or deleted (admins may bypass both). The `production`
  environment requires Benjamin's approval. It names no branch: Alchemy writes only branch rules there and would
  delete a tag rule, and a branch rule refuses every tag.
- **CI runs on `release/**` too**, so a cherry-picked fix is checked on its branch before its tag is pushed.

## Staging

`staging` is a rehearsal, like a preview. It is on `workers.dev`, has the two test organizations and the test
accounts, keeps sign-up closed, and has no model key. The rules answer, since decision I5 gives a key to production
only. Its test accounts take the one password the previews share. It runs on the previews' Cloudflare account, from
the `staging` environment, which only `main` may deploy to. Nobody deploys it until Benjamin has deployed the
repository's stack with the `staging` environment in it (`goals/infra/PLAN.md`, "What Benjamin does by hand").
