---
type: Reference
title: GitHub provider
description: Alchemy's provider for github.com (repositories, rulesets, environments, Actions secrets and variables, webhooks, comments and runtime API bindings); this app uses it to declare the repository's deploy settings and its rule on main.
tags: [alchemy-domain, extras]
---

# GitHub provider

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

`@alchemy.run/github` turns the settings around a GitHub repository into Stack resources. A deploy creates them and
converges them to what the code declares; when one leaves the stack, its removal policy decides whether it is deleted,
kept or closed on GitHub. It covers the repository and its rules, Actions environments, secrets and variables,
webhooks, issues, pull requests, comments, releases and wiki pages, plus runtime "bindings" a Worker can call. It acts
as whoever owns its token. The docs describe it as "the glue for CI/CD" [https://alchemy.run/github]. It configures
what a workflow reads; it does not write the workflow.

It is not [Alchemy Git](./alchemy-git.md), which is a git server you host.

## When to reach for it

- A value CI needs comes out of another resource (a scoped Cloudflare token, an account id): write it straight into
  an Actions secret or variable in the same deploy, so nobody copies it.
- A rule about the repository (who may merge to `main`, which check must pass, who approves production) should be
  reviewed in a pull request like code.
- A deploy should report back on a pull request (one comment, updated in place), or a Worker should react to
  repository events.

## How it is declared

Register the provider beside Cloudflare's, then yield resources. Every resource except `PersonalAccessToken` takes
`owner`, `repository` (or `name` for `Repository`) and an optional `baseUrl` for GitHub Enterprise; changing `baseUrl`
replaces the resource. `PersonalAccessToken` takes only an optional `token`.

```ts
// SKETCH: not compiled
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as GitHub from "@alchemy.run/github"
import * as Alchemy from "alchemy"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export default Alchemy.Stack(
  "inventory-github",
  { providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()), state: Cloudflare.state() },
  Effect.gen(function* () {
    const production = yield* GitHub.Environment("Production", {
      owner: "kriegcloud",
      repository: "inventory-import",
      name: "production",
      reviewers: { users: ["release-approver"] },
      deploymentBranchPolicy: { customBranchPolicies: ["main"] }
    })
    yield* GitHub.Variable("ProductionSignUp", {
      owner: "kriegcloud",
      repository: "inventory-import",
      environment: production,
      name: "SIGN_UP",
      value: "closed"
    })
  })
)
```

Every resource the provider registers (`packages/github/src/Providers.ts:74-90`, seventeen providers), one line each,
and whether the app's stack declares it today:

| Resource | What it manages (props beyond owner/repository) | In the app's stack |
| --- | --- | --- |
| `Repository` | The repository itself: `name`, `description`, `homepage`, `visibility` (`public` default, `private`, `internal`), `hasIssues`, `hasProjects`, `hasWiki`, `hasDiscussions`, `isTemplate`, `archived`, `defaultBranch`, the four merge settings, `deleteBranchOnMerge`, `topics`, `autoInit`, `gitignoreTemplate`, `licenseTemplate` | no |
| `Ruleset` | A repository ruleset: `name`, `enforcement` (`active` default, `evaluate`, `disabled`), `target` (`branch` default, `tag`), `conditions.include`/`exclude`, `bypassActors` (`RepositoryRole`, `Team`, `Integration`, `OrganizationAdmin`; `bypassMode` `always` or `pull_request`), `requiredStatusChecks`, `requiredSignatures`, `pullRequest`, `creation`, `update`, `deletion`, `requiredLinearHistory`, `nonFastForward`, `mergeQueue` | yes, `Main` |
| `BranchProtection` | Classic branch protection on one `branch` (the legacy API): required checks and reviews, restrictions, `enforceAdmins`, signatures, linear history, force pushes, deletions, `lockBranch`, `allowForkSyncing` | no |
| `Environment` | An Actions environment: `name`, `waitTimer`, `preventSelfReview`, `reviewers.users`/`teams`, `deploymentBranchPolicy` (`{ protectedBranches: true }` or `{ customBranchPolicies }`) | yes, `Production`, `Preview` |
| `Secret` | One Actions secret: `name`, `value` (`Redacted`), `environment` (a name or an `Environment`) | yes, four |
| `Variable` | One Actions variable: `name`, `value`, `environment` | yes, four |
| `Secrets`, `Variables` | Not providers: functions that yield one `Secret` or `Variable` per map key (`Secrets.ts:55-64`, `Variables.ts:53-62`) | no |
| `Webhook` | A repository webhook: `url` (may be an `Output`), `events` (`["push"]` default, `["*"]` for all), `secret`, `contentType`, `active`, `insecureSsl` | no |
| `Collaborator` | One person's access: `username`, `permission` (`push` default) | no |
| `TeamAccess` | An existing team's access: `teamSlug`, `permission` (`push` default) | no |
| `Label` | An issue label: `name`, `color`, `description` | no |
| `Milestone` | A milestone, found by `title` | no |
| `Issue` | An issue: `title`, `body`, `state`, `labels`, `assignees`, `milestone` | no |
| `PullRequest` | A pull request from an existing `head` branch into `base` | no |
| `Release` | A release on `tagName`; creates the tag from `targetCommitish` when it does not exist (`Release.ts:56-61`) | no |
| `Comment` | One comment on `issueNumber` (issue or pull request), `body` dedented; `allowDelete` (default false) | no |
| `WikiPage` | A page in the separate wiki repository, pushed with `git`; `allowDelete` (default false) | no |
| `PersonalAccessToken` | Captures a token for a host (default the provider's credential); mints nothing | no (a binding would add one) |

`Repository`'s `autoInit`, `gitignoreTemplate` and `licenseTemplate` act only when the repository is created
(`Repository.ts:134-151`). `topics` replaces the whole list, and removing the prop clears it (`Repository.ts:557-566`).
`archived` goes in a PATCH of its own (`Repository.ts:549-555`). A `defaultBranch` that does not exist yet is dropped
and the rest still converges (`Repository.ts:527-547`).

Beyond resources:

- Runtime bindings, each a `Binding.Service` with an `*Http` layer for a Worker and a `*Local` layer for deploy time:
  `CreateIssue`, `GetIssue`, `UpdateIssue`, `ListIssues`, `SearchIssues`, `CreateIssueComment`, `ListIssueComments`,
  `GetPullRequest`, `ListPullRequests`, `CreatePullRequest`, `MergePullRequest`, `CreatePullRequestReview`,
  `ListPullRequestReviews`, `ListPullRequestReviewComments`, `ListPullRequestFiles`. Each is called with a
  `GitHub.Repository` resource. `GetIssue` and `UpdateIssue` fail with `IssueNotFound` (`Errors.ts:3-8`).
- `consumeRepositoryEvents(props, handler)` with `RepositoryEventSourceLive`: provisions a `Webhook` pointing at the
  host, verifies `X-Hub-Signature-256`, and hands the handler a typed event. It works on any `WebhookHost`; today only a
  Cloudflare Worker is one (`RepositoryEventSourceLive.ts:18-42`; `website/src/content/docs/github/events.mdx:114-119`).
  Deliveries go to `/__alchemy/github/<owner>/<repository>` unless `path` is set; with no `secret` a stable random one
  is made, and the secret is bound on the host as `ALCHEMY_GITHUB_WEBHOOK_SECRET_<owner>_<repository>`
  (`RepositoryEventSource.ts:169-180`, `RepositoryEventSourceLive.ts:54-61`). A non-POST gets 405, a bad signature 401,
  and 202 comes only after the handler finishes; a handler failure becomes a defect (`RepositoryEventSourceLive.ts:97-137`).
  Always pass `owner` and `repository`: the overload that takes only a handler passes empty props
  (`RepositoryEventSource.ts:144-147`).
- `GitHubEnv`: a `Config` that is `undefined` outside Actions, and otherwise gives `sha`, `owner`, `repository` and
  `pr` (from a `PULL_REQUEST` variable the workflow must export; `Env.ts:18-26`).
- `lookup` on `Repository`, `Ruleset`, `Environment`, `Label`, `Milestone`, `Issue`, `PullRequest` and `Release`
  references something the stack does not manage: read at plan and deploy, never written.
- The package exports every source file by subpath (`package.json` `"./*"`), so helpers `index.ts` leaves out
  (`BaseUrl`, `Credentials`, `resolveEnvironmentName`, `webhookPath`, `webhookSecretEnvName`) are importable as
  `@alchemy.run/github/<File>`; `Auth` (the auth provider) is internal.

Authentication (settings named, no values):

- `GitHub.providers()` reads a profile. Its two methods are `gh-cli` and `stored` (a personal access token); browser
  and device OAuth are not offered (`AuthProvider.ts:125-132`). `gh-cli` runs `gh auth token` on first use and then
  saves that token in the profile and reuses it, so a token refreshed in `gh` is picked up only at the next profile
  login (`AuthProvider.ts:306-331`, `:344-358`).
- With `CI=true` profiles are skipped (`website/src/content/docs/github/setup.mdx:27-28`) and the token comes from
  `GITHUB_ACCESS_TOKEN` or `GITHUB_TOKEN`; on an enterprise host `GH_ENTERPRISE_TOKEN` and `GITHUB_ENTERPRISE_TOKEN`
  are tried first (`AuthProvider.ts:81-103`). The host comes from `GITHUB_BASE_URL`, `GITHUB_API_URL` or `GH_HOST`
  (`BaseUrl.ts:60-70`); `api.github.com` counts as github.com (`BaseUrl.ts:28-30`). `GitHub.providers({ baseUrl })`
  pins the host for every resource and for the login (`Providers.ts:36-51`).
- `fromToken`, `fromEnv` and `fromApp` replace the profile. `fromApp` acts as one GitHub App installation, mints its
  token on first use and again a minute before the hour runs out, and fails a call with `GithubAppAuthError` when a mint
  is refused (`Credentials.ts:80-116`).

Checked in (all at `v2.0.0-beta.87`, every file of `packages/github/src`): `index.ts:1-71`; `Providers.ts:28-90`;
`Repository.ts:18-29`, `:399-400`, `:417-423`, `:434-449`, `:603-620`; `Ruleset.ts:318-332`, `:466-468`, `:474-490`,
`:500-581`, `:634-654`, `:679-690`; `Environment.ts:25-61`, `:147-149`, `:245`, `:265-276`, `:299-378`, `:429-438`;
`Secret.ts:73-75`, `:145`, `:167-179`, `:189-212`; `Variable.ts:74-76`, `:143`, `:153-165`, `:167-196`; `Webhook.ts:151`,
`:164-174`, `:190-205`, `:244-250`; `BranchProtection.ts:359`, `:418-430`, `:514-524`, `:565-573`;
`Collaborator.ts:79-80`, `:129-130`, `:135-157`; `TeamAccess.ts:80-81`, `:148-149`, `:154-176`; `Label.ts:247-301`,
`:333-342`; `Milestone.ts:262-322`, `:388-397`; `Release.ts:319-338`, `:438-462`; `Issue.ts:225-247`, `:276-285`,
`:378-391`; `PullRequest.ts:295-349`, `:453-468`; `Comment.ts:10-51`, `:157`, `:175-232`; `WikiPage.ts:229`,
`:465-495`, `:521-545`; `PersonalAccessToken.ts:8-86`; `BindingHttp.ts:89-98`; `BindingLocal.ts:13-20`;
`CreatePullRequest.ts:12-13`; `AuthProvider.ts:81-103`, `:125-132`, `:221`, `:306-358`, `:440-460`.

### What main changes

Docs: nothing (all seven pages under `website/src/content/docs/github/` are identical). Source, two changes; every
other file of `packages/github/src` is the same:

- `packages/github/src/Providers.ts:96` on main: the provider layer now supplies distilled's GitHub `Retry` service
  with Alchemy's `DeployRetry.policy`, so GitHub API calls made during a deploy retry under the deploy's policy
  (commit `b50f3f514`, 2026-11-14, pull request #3354).
- `packages/github/src/Secrets.ts:76` on main: `Secrets` recognizes an Effect value through `isEffectOf` instead of
  `Effect.isEffect`; same behavior for callers (commit `615d87516`, #3222).

## Rules, and the mistakes to avoid

- **It cannot write files into the repository, nor make a branch or a commit there.** No resource writes
  `.github/workflows`, `CODEOWNERS`, Dependabot configuration or any other content (no use of the contents API in
  `packages/github/src`). `WikiPage` pushes commits only to the separate wiki repository. The one ref it makes in the
  repository is a `Release`'s tag. `PullRequest` and the `CreatePullRequest` binding need the `head` branch to exist
  already (`CreatePullRequest.ts:12-13`). Workflow YAML stays hand-written.
- Also absent at beta.87 and main: Actions permission and allowed-actions settings, deploy keys, Dependabot and
  Codespaces secrets, Pages, security and analysis settings, custom deployment protection rules, and anything at
  organization level (secrets, variables, rulesets, teams: `TeamAccess` only grants access to a team that exists).

What a change replaces, what taking a resource out of the stack does on GitHub, and what a first deploy does to an
object of the same name that already exists:

| Resource | Replaced when this changes (and host) | Taken out of the stack | An existing one with the same name |
| --- | --- | --- | --- |
| `Repository` | `owner` (a new, empty repository; the old one kept). A new `name` renames in place | kept; `destroy()` deletes it, needs `delete_repo` | taken over silently, settings converged (`Repository.ts:443-447`) |
| `Ruleset` | `owner`, `repository` | kept and still enforced; `destroy()` deletes it | read as unowned; taken only with `adopt(true)`, then rewritten to the declared rules (`Ruleset.ts:634-654`) |
| `BranchProtection` | `owner`, `repository`, `branch`, or any prop unresolved at plan | protection removed | read as its own (`BranchProtection.ts:514-524`) |
| `Environment` | `owner`, `repository`, `name` | deleted, with its reviewers and branch policy | taken over silently: one PUT upsert (`Environment.ts:334`); branch patterns not declared are deleted |
| `Secret` | `owner`, `repository`, `name`, `environment` | deleted | overwritten silently (upsert, `Secret.ts:203-208`) |
| `Variable` | `owner`, `repository`, `name`, `environment` | deleted | taken over silently, value patched (`Variable.ts:180-196`) |
| `Webhook` | `owner`, `repository` | deleted | not seen: found only by the id it stored, so a second hook is added beside a hand-made one (`Webhook.ts:190-205`) |
| `Collaborator`, `TeamAccess` | `username` or `teamSlug`, `owner`, `repository` | kept; `destroy()` revokes access | permission converged silently (PUT) |
| `Label`, `Milestone`, `Release` | `name`, `title` or `tagName`, `owner`, `repository` | deleted | taken over silently by name, title or tag |
| `Issue` | `owner`, `repository` | kept open; `destroy()` closes it | never: a new issue is opened (`Issue.ts:276-285`) |
| `PullRequest` | `owner`, `repository`, `head`, `base` | kept; `destroy()` closes it if open | an open one with the same `head` and `base` is taken over (`PullRequest.ts:338-349`) |
| `Comment` | `issueNumber`, `owner`, `repository` | kept unless `allowDelete` | never: found only by its stored id |
| `WikiPage` | the page name, `owner`, `repository` | kept unless `allowDelete` | overwritten by title (`WikiPage.ts:465-490`) |

Sources: each resource's `diff` and `delete`, and its removal policy: `Repository`, `Ruleset`, `Collaborator`,
`TeamAccess`, `Issue` and `PullRequest` default to retain; the rest have none, so they are deleted.

- **A removal follows the policy stored in state, not the one in the code.** When a declaration is deleted, the plan
  reads the policy from the resource's stored row: retain gives "orphaned", anything else "delete"
  (`packages/alchemy/src/Plan.ts:2617` at `v2.0.0-beta.87`, `:2613` on main). A changed policy on a resource still
  declared is written to state on the next deploy even when nothing else changed (`packages/alchemy/src/Apply.ts:733-756`,
  both refs). So to remove a retained resource from GitHub: wrap it in `destroy()` from `alchemy/RemovalPolicy`, deploy,
  then delete the declaration and deploy again.
- Only `Ruleset` asks before taking over an existing object. `Repository`, `Environment`, `Secret`, `Variable`,
  `BranchProtection`, `Collaborator`, `TeamAccess`, `Label`, `Milestone`, `Release` and `WikiPage` take one over by
  name on the first deploy, and converge it to the declared props.
- `Secrets` and `Variables` use each map key as the logical id and as the name, so one stack cannot put the same name
  into two environments with them: the logical ids collide. Use one `Secret` or `Variable` per environment, each with
  its own logical id.
- A ruleset's required check is matched by its context string. For an Actions job that is the job's `name` (here
  "Check, test and build", `.github/workflows/ci.yml`); renaming the job blocks merges until the ruleset is
  redeployed, which is why the admin bypass exists. A check can be pinned to one app with `integrationId`
  (`Ruleset.ts:94-97`), so a status sent under the same name from elsewhere does not satisfy it.
- Setting `pullRequest` sets every pull-request rule it leaves out to off or zero (`Ruleset.ts:527-546`). A ruleset
  with no `conditions` targets every branch (`~ALL`, `Ruleset.ts:576-581`). `update: true` also forbids
  fetch-and-merge (`Ruleset.ts:509-514`).
- GitHub never returns a secret's value, so every deploy re-encrypts and re-uploads every `Secret`. A wrong
  environment variable on the deploying machine silently overwrites a stored secret.
- `Environment`: at most six reviewers; logins and team slugs are turned into ids at deploy time, so an unknown login
  fails the deploy; teams only on an organization's repository (`Environment.ts:44-61`, `:303-318`). `waitTimer` is 0
  to 43200 minutes. Wait timers and reviewers are sent only when set now or before, because GitHub refuses them as a
  billing error on a private repository without the plan (`Environment.ts:320-342`). `customBranchPolicies` are branch
  patterns only, and leaving the policy out lets every branch deploy (`Environment.ts:343-378`). Environments on private
  repositories need a paid plan; protection rules there need Team or Enterprise (`Environment.ts:147-149`). Merge
  queues need an organization-owned repository.
- Scopes. The docs ask for `repo` always, `workflow` for Actions secrets and variables, and `delete_repo` only to
  delete a repository (`website/src/content/docs/github/setup.mdx:87-89`); the profile prompt asks for `repo` and
  `workflow` (`AuthProvider.ts:221`). The source's own comments differ: `Secret` and `Variable` say `repo`, or
  `public_repo` on a public repository (`Secret.ts:73-75`, `Variable.ts:74-76`); a ruleset needs `repo` or
  Administration write on a fine-grained token (`Ruleset.ts:330-332`); a webhook needs admin access
  (`Webhook.ts:116-118`); `TeamAccess` needs `admin:org` (`TeamAccess.ts:80-81`); removing a collaborator needs
  `admin:repo` (`Collaborator.ts:79-80`).
- A Worker given any GitHub binding holds the deployer's token. Every `*Http` binding captures one
  `PersonalAccessToken` named `<host logical id>GitHubToken` with no props (`BindingHttp.ts:89-98`), so it takes the
  provider's credential with every scope it has (`PersonalAccessToken.ts:80-86`). To bind a narrower token, deploy
  under a narrower credential (for example `fromApp` with fewer permissions). A token revoked outside Alchemy reads as
  gone and the next deploy captures the current credential. The `*Local` layers bind nothing.
- A stack that can rewrite the rule on `main` must not run from a workflow: a job that can change its own approval
  rule has none. Deploy it from a workstation.

## In this app

`packages/infra/src/GitHub.stack.ts` already declares, for `kriegcloud/inventory-import`: two `Environment`s
(`production` with one required reviewer, read from the `PRODUCTION_APPROVER` setting, and only `main` may deploy;
`preview`); two Cloudflare `AccountApiToken`s written as environment-scoped `CLOUDFLARE_API_TOKEN` `Secret`s;
production's `OPENROUTER_API_KEY` `Secret` (only when a key is given); the previews' `PREVIEW_TEST_ACCOUNT_PASSWORD`
`Secret`; `Variable`s `CLOUDFLARE_ACCOUNT_ID` (both), `SIGN_UP` and `DEPLOY_WITHOUT_MODEL_KEY` (production); and one
`Ruleset` named `main` on `~DEFAULT_BRANCH`, active (pull request required, zero approvals, the check "Check, test and
build" required without the up-to-date rule, no deletion, no force push, the admin repository role, id 5, bypasses
always; `GitHub.stack.ts:109-190`). `.github/workflows/deploy.yml` reads exactly those names. It already uses one
`Secret` per environment for `CLOUDFLARE_API_TOKEN`, as the `Secrets` collision requires.

What taking each out of `GitHub.stack.ts` does:

- `Ruleset("Main")`: the rule on `main` stays on GitHub, active, with nothing managing it. To remove it, deploy it once
  with `.pipe(RemovalPolicy.destroy())`, then delete the declaration.
- `Environment("Production")` or `Environment("Preview")`: the environment is deleted, with its reviewer and branch
  policy. GitHub then drops that environment's secrets and variables too (GitHub's behaviour, not in this source).
- Any `Secret` or `Variable`: deleted, so the next deploy job that reads it fails.

On a first deploy against a repository configured by hand, the two environments and every secret and variable are
taken over and overwritten without a prompt; a hand-made ruleset named `main` is left alone until `adopt(true)`.

What it could add, each declared in the same stack:

```ts
// SKETCH: not compiled
// The repository's own settings, kept on destroy. The existing repository is found by name and converged in place.
yield* GitHub.Repository("Repository", {
  owner: "kriegcloud",
  name: "inventory-import",
  hasWiki: false,
  hasProjects: false,
  allowMergeCommit: false,
  allowRebaseMerge: false,
  allowSquashMerge: true,
  deleteBranchOnMerge: true
})
```

- `Repository` as above, so merge strategy and branch clean-up are code. The ruleset can also hold the merge method
  itself (`pullRequest.allowedMergeMethods: ["squash"]`, `Ruleset.ts:141-144`).
- On the ruleset, pin "Check, test and build" to GitHub Actions with `integrationId`.
- On `production`, `preventSelfReview: true` (default false, `Environment.ts:37-42`): the approver then cannot approve
  a deploy they started. With one approver that blocks their own merges, so add it with a second reviewer.
- A preview comment from `Inventory.stack.ts`: when `GitHubEnv` is defined and has a `pr`, one
  `GitHub.Comment("PreviewComment", ...)` whose `body` is built with `Output.interpolate` from `website.url`, updated
  on every push. Each pull request deploys its own `pr-<number>` stage, so each gets its own comment; with
  `allowDelete: true`, destroying that stage deletes it. This needs the deploy job to export `PULL_REQUEST` and
  `GITHUB_TOKEN` and to grant `pull-requests: write` in `deploy.yml` (hand-edited), and `GitHub.providers()` in that
  stack. The `Comment` JSDoc mentions a `token` prop; there is none (`Comment.ts:84-86` against `:10-51`).
- `Label`s for triage (`import-rules`, `screens`) if the owner wants them as code.
- Should a later goal host [Alchemy Git](./alchemy-git.md) history on a stage, a `GitHub.Secret` can carry that
  host's push key to a mirror step.

What it cannot do here: write `ci.yml` or `deploy.yml`, set the workflow's `permissions`, enable Actions settings, or
create a branch or commit.

- **Used today:** yes: `packages/infra/src/GitHub.stack.ts` (`Environment`, `Secret`, `Variable`, `Ruleset`), at
  `@alchemy.run/github` `2.0.0-beta.87` (`packages/infra/package.json`).
- **Where it goes:** `packages/infra/src/GitHub.stack.ts` for repository settings; `packages/infra/src/Inventory.stack.ts`
  for a preview comment.
- **What the person gets:** nothing they see in the app; the owner gets repository rules and CI credentials that are
  reviewed as code, and (with the comment) each pull request shows its preview address.

## How to check it

- `bunx alchemy deploy packages/infra/src/GitHub.stack.ts --stage prod` from the workstation, then
  `gh api repos/kriegcloud/inventory-import/rulesets` and `gh api repos/kriegcloud/inventory-import/environments`
  show what was declared; a second deploy with no change plans no updates except the secrets (always re-uploaded).
- Before deleting a declaration, read the plan: a retained resource shows as orphaned (left on GitHub), the rest as
  deleted.
- A pull request whose "Check, test and build" fails cannot merge for a non-admin; an admin can (the bypass).
- A preview job's log shows `CLOUDFLARE_ACCOUNT_ID` from the `preview` environment and no production secret.
- The stack's pure parts (`StagePlan.rules.ts`: `modelKeyFor`, `givenTestPassword`) have their tests in
  `packages/infra/test`.

## What it needs

- A GitHub token with `repo` (and `workflow` for Actions secrets and variables): the `gh-cli` or `stored` profile on
  the workstation, or `GITHUB_ACCESS_TOKEN` / `GITHUB_TOKEN` with `CI=true`. The account must be able to administer
  the repository (rulesets, environments).
- The app's stack also reads `PRODUCTION_CLOUDFLARE_ACCOUNT_ID`, `PREVIEW_CLOUDFLARE_ACCOUNT_ID`,
  `PRODUCTION_APPROVER`, `SIGN_UP`, `OPENROUTER_API_KEY`, `DEPLOY_WITHOUT_MODEL_KEY` and
  `PREVIEW_TEST_ACCOUNT_PASSWORD`, and Cloudflare credentials for the two tokens and the state store.
- No host: these are deploy-time resources. `consumeRepositoryEvents` alone needs a `WebhookHost`, today a Cloudflare
  Worker.
- beta.87 has everything listed; main adds only the retry policy.
- Independent of `@alchemy.run/domain`.

## Verdict

**Use:** keep declaring environments, secrets, variables and the ruleset in `GitHub.stack.ts` from the workstation,
and add `Repository` (and, if wanted, a preview `Comment`) the same way.

**Cannot yet:** declare the workflow files. Nothing in the provider writes repository contents; it would take a new
resource over GitHub's contents API (or a commit pushed by the deploy). Until then `ci.yml` and `deploy.yml` stay
hand-written.

## Where this was read

- https://alchemy.run/github (the live site documents beta.87)
- `website/src/content/docs/github/` (all seven pages) at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/github/src/` (all 77 files) at `v2.0.0-beta.87`; on `main@dbfd0ddb`: `Providers.ts`, `Secrets.ts`
  changed, the rest same
- `packages/github/package.json` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/alchemy/src/Plan.ts`, `packages/alchemy/src/Apply.ts`, `packages/alchemy/src/RemovalPolicy.ts` at
  `v2.0.0-beta.87` (the published package) and on `main@dbfd0ddb`
- The app: `packages/infra/src/GitHub.stack.ts`, `packages/infra/src/StagePlan.rules.ts`,
  `packages/infra/src/Inventory.stack.ts`, `packages/infra/package.json`, `.github/workflows/ci.yml`,
  `.github/workflows/deploy.yml`, `explorations/ideal-architecture/DECISIONS.md` (24, I7),
  `research/02-alchemy-infra.md` §3.11
