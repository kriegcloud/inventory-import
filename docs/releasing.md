---
type: Tooling Guide
title: Releasing and deploying
description: How a change reaches people: work lands on main, which deploys staging; a release is a branch cut from main and a tag on its head, pushed together, which deploys production once CI passed on the branch and Benjamin approves; a fix to a released version is cherry-picked from main and tagged with the next patch.
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
| A push to `release/<major>.<minor>` passes CI, and the branch's head carries its tag `v<major>.<minor>.<patch>` | Production, at that commit, once the `production` environment's reviewer approves |

## The version

The app has one version, and a release tag is what says it. `bun run release` writes it into
`apps/inventory/package.json` and into `bun.lock`'s copy of it, on the release branch only: a release commit is never
on `main`, so `main`'s file keeps the version it had (0.6.1) and staging reports that. The packages are Turborepo's
Internal Packages: none is published, so none has a version of its own and Changesets is not used. It is added if a
package is ever published. The "(v0.6.1)" in `README.md` names the version that was submitted and never moves.

`CHANGELOG.md` is on release branches only, for the same reason. A new line's file starts from the file of the
highest release there is, and adds its own. A patch made on an older line after that highest release was cut is in
the older line's file only: `release/0.9`'s file has no entry for a `v0.7.1` made after `v0.8.0`.

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
   the subjects of the commits the highest release does not carry, grouped as Added (`feat`), Fixed (`fix`), and so
   on. Commits are compared by their change, so a fix that release already carries as it landed is not listed
   again. Two kinds of fix are listed again: one a patch carried with changes, and one an older line released
   after the highest release was cut;
8. commits `chore: release v<version>`, which changes those three files and nothing else, and makes an annotated
   tag holding the same notes.

The check runs before the release commit exists. That commit only moves the version and adds the notes, and CI checks
it on the release branch before anything deploys.

It pushes nothing. It prints one command, which sends the branch and the tag together or neither:

```bash
git push --atomic origin release/0.7 v0.7.0
```

Production's gate is CI on the release branch (Benjamin's choice of 2026-11-22). The push starts CI on the branch.
When it passes, the deploy workflow starts from `main`'s copy of the file, whatever the release branch holds. Its
job "Check the release" checks out `main`, fetches the tags and runs
`bun run beep release verify-head <branch> <commit>` with the commit CI checked. That command is `main`'s too. It:

- deploys nothing, and says so, when the branch has moved on from the commit CI checked, or when that commit
  carries no release tag (a cherry-picked fix pushed before its `release patch`). A tag pushed alone starts
  nothing: no workflow listens for a tag;
- refuses a branch that is not `release/<major>.<minor>`, a commit with more than one release tag, and a tag that
  is not a release of the branch CI passed on (a new branch pointed at an old release's commit deploys nothing);
- then holds the release command's rules again on the tagged commit, against the remote's branches:
  - the tag is annotated, and a version;
  - its commit is on `origin/release/<major>.<minor>` and is not on `origin/main`;
  - its commit is a release commit: one parent; it changes only the app's file, `bun.lock` and `CHANGELOG.md`, with
    a rename told as a removal and an addition; the app's file and `bun.lock` are, byte for byte, their parent's
    with the version moved, so a script, a dependency or a resolution added beside the version is refused. The
    text of `CHANGELOG.md` is the one thing not compared;
  - what is under it landed on main: for `<major>.<minor>.0` its parent is a commit of `origin/main`; for a patch
    the release before it is under it, every commit between is one whose change `origin/main` holds or a pick with
    changes (below), and none is a merge;
  - for a patch, the release before it passes these same rules, and the one before that, down to the line's first.
    A tag the guard refuses therefore stops every later patch of its line until an admin deletes or replaces it.

A question git cannot answer (a branch that was not fetched) refuses the release. A release that fails stops there,
before anyone is asked to approve. Then production waits for Benjamin's approval in the `production` environment.
After the approval, and on any re-run of that job, its first step asks the remote again: the commit must still be
the head of its release branch and still carry the tag, or the job fails. Approving an old run after a later
release of the same line was deployed therefore deploys nothing. It reads only the ref whose name is exactly
the branch's, or the tag's: `git ls-remote` also lists refs whose names merely end the same way. Each tag waits in a group of its own, so a release
that waits for its approval is never cancelled by a later one; two releases are not deployed at once because one
person approves them. Nothing orders the releases of two lines: if `release/0.7` and `release/0.8` both wait, the
one approved last is what production runs.

`bun run beep release verify <tag>` runs the same rules on a tag by hand.

## A fix to a released version

1. Land the fix on `main`, as any change: a pull request, its check, its preview.
2. Cherry-pick it onto the release branch, keeping the trail: `git switch release/0.7`, then
   `git cherry-pick -x <commit>`.
3. On that branch: `bun run release patch`. It fetches as a cut does, and refuses:
   - a commit since the last tag whose change `origin/main` does not hold. `git cherry` compares each commit's
     change, so a cherry-pick that applied as it was counts. One whose conflict was resolved by hand differs from
     main's; it counts when its `(cherry picked from commit <hash>)` line, alone on a line as `-x` writes it, names
     a commit of `origin/main` (Benjamin's choice of 2026-11-22: accept, and name it). No flag is typed. A commit
     with no such line, with the words inside a sentence, or whose line names a commit main does not have, is
     refused.

     What is checked is that line and nothing more: nothing compares the edited change with main's, and the commit
     it names can be any commit of main. So each such commit is listed under "Picked with changes", with its
     subject, its hash here and the hash it names, in four places: the command's output, the notes, the tag's
     message, and the log of the "Check the release" job. The approval screen itself shows none of it. Before
     approving a release that lists one, read that commit (`git show <hash here>`) beside the one it names;
   - a merge commit, which `git cherry` never lists, so anything could ride in on one;
   - a branch here that does not hold the line's last release (a tag that was fetched, on a branch that was not
     pulled);
   - a last release the deploy guard refuses, or one that was never pushed: a patch stands on a release the remote
     holds and the guard passes, so what is under a tag made by hand is not forgotten by the next patch;
   - a branch on which nothing landed since the last tag, or that has never been tagged;
   - a version that would not go up: the app's file on the branch already says one at or above the next patch.

   It tags `v0.7.<n+1>` with notes from those commits, and prints the push command.

A patch never goes the other way: nothing lands on a release branch first.

## What holds it

- **The release command's guards**, each with a test that fails without it
  (`packages/tooling/tool/cli/test/Release.test.ts`, on real git repositories with a remote): the refusals listed
  above and nothing after a red check. A tag lands on the branch of its own major and minor by how the version is
  worked out (a new line's branch is named from its version; a patch's version is the next on the branch it is run
  on), and a major or minor version cannot fail to go up, because it is the next above every release; the refusal of
  a version that would not go up is shown for a patch.
- **The deploy guard**, `release verify-head` and the `release verify` it ends in, tested in the same file: every
  refusal above has a test that fails without it, among them a release commit made by hand that changes more inside
  a file it may touch, a tag on a merge, a branch pointed at an old release, a release standing on one the guard
  refuses, and a commit with no message. Not tested: the answers for git itself failing on a question other than
  "is the commit on main", and a lockfile that exists on one side of the release commit only.
- **The deploy workflow** (`.github/workflows/deploy.yml`) starts production only after CI passed on a push to a
  `release/` branch of this repository, after its guard job found a tag that may deploy, and runs that guard from
  `main`. `test/DeployWorkflow.test.ts` in the same package parses the file and holds every job's event,
  environment and secrets, and every step of every job in order: each action by name and version with what it is
  given, each command word for word, each step's own condition, and what each step and each job is told (every variable by
  name, with what is written for it). The three shell guards are held as whole scripts, and run: main's and the
  release branch's with a branch on the remote whose name only ends as the real one does, and production's also
  with the branch's head as the commit checked and only a tag whose name ends as the release's does on it. What an
  action does inside is not read. The workflow files are inputs of that test in `turbo.json`, so a change to one always runs it.
- **The repository's stack** (`packages/infra/src/GitHub.stack.ts`): only an admin may create, move or delete a `v*`
  tag, and a `release/*` branch is never force-pushed or deleted (admins may bypass both). The `production`
  environment requires Benjamin's approval and takes only a run whose ref is `main`. A workflow started by another
  workflow's end always runs as `main`, so the release job passes that rule; a run from any other branch or tag
  that names the environment is refused by GitHub before the approval is asked.
- **CI runs on `release/**` too**, and its passing there is what starts the release.

**Not verified on GitHub.** This flow has run nowhere but in tests on this machine. Three things rest on GitHub's
documented behaviour and have not been tried there: that a workflow started by CI's end (`workflow_run`) runs
`main`'s copy of the file with `main` as its ref; that the `production` environment's `main`-only rule then lets
that run through and refuses others; and that the job's groups keep a waiting release from being cancelled. The
first real release is where they are verified: after the push, the Actions run named "Deploy" should show "Check
the release" printing the tag, then `production` waiting for approval. If it does not start, nothing was deployed
and nothing needs undoing.

What GitHub has shown so far (read with `gh` on 2026-11-22, nothing changed there): after CI passed on the pushes
of `main` at 3bc2522, 0c4c5e5 and c1322d6, a "Deploy" run started each time with the event `workflow_run`. In each,
"Preview", "Remove the preview", "Check the release" and "Production" were skipped, and "Staging" ran: its step
"Deploy only the commit main is at" passed, and "Deploy staging" failed with `MissingPreviewPassword`, as the
Staging section below expects. So the trigger and staging's condition work as written for `main`. Nothing has run
for a release branch: no release has been cut.

## Staging

`staging` is a rehearsal, like a preview. It is on `workers.dev`, has the two test organizations and the test
accounts, and has no model key. Sign-up is closed unless the `staging` environment's `SIGN_UP` variable names
emails (decision "staging, invited sign-up"); an email named there may make a real account. The rules answer, since decision I5 gives a key to production
only. Its test accounts take the one password the previews share. It runs on the previews' Cloudflare account, from
the `staging` environment, which only `main` may deploy to. Nobody deploys it until Benjamin has deployed the
repository's stack with the `staging` environment in it: `bun run beep infra setup --staging` on his workstation,
which makes the previews' password in 1Password, finds the two Cloudflare accounts, shows the stack's plan and
deploys it after his yes (`goals/infra/PLAN.md`, "What Benjamin does by hand"; `--dry-run` prints its steps). The
browser logins, unlocking 1Password, reading the plan and, later, approving each production deploy stay his.

Until then every push to `main` that passes CI is followed by a failed "Deploy" run: the `staging` job stops with
`MissingPreviewPassword` ("Stage "staging" has no password for its test accounts"), because the environment that
gives it the password does not exist yet. Seen on GitHub on 2026-11-22, after the first push. Nothing is deployed
by that run, and it is left failing on purpose: a staging that cannot deploy is a failure whatever the cause, and a
job that skipped quietly when its secrets are missing would also skip quietly if they were ever removed. The run
goes green by itself on the first push after the stack is deployed.

It deploys only `main`'s head: a CI run that is run again for an older commit, or that finishes after a newer
commit's, deploys nothing, so staging never goes backwards. If the newest commit's CI fails, staging stays where it
was.

Its token is the previews' token, and stays so (Benjamin's choice of 2026-11-22: keep sharing, and say so). A
Cloudflare token's Workers and D1 permissions cover a whole account, so every preview job holds a token that can
change or remove staging, and a pull request's run uses the pull request's own copy of the workflow. The `staging`
environment's "only main" rule therefore says which run may use that environment, not who can reach staging: anyone
who can push a branch to this repository can. Staging holds test accounts only and no model key.

That token is Benjamin's own (his choice of 2026-11-22: "Use my own token"). The repository's stack does not make
it: production's login does not reach the previews' account, so he made an account-owned token there, and the stack
asks 1Password for it and writes it to the `preview` and `staging` environments. Said plainly: it is broader than a
token made for the purpose, since it allows whatever he gave it in the dashboard and not only the five permissions a
deploy needs; every preview job and every staging job holds it; and nobody rotates it but him. To rotate: make a new
token in the previews' account (Manage Account, Account API Tokens), put its value in the 1Password item, run
`bun run beep infra setup --staging` and read the plan (the two token secrets change, nothing else), then revoke
the old one. Production's token is still made by the stack, narrow, in production's account.
