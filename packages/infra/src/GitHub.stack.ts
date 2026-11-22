/**
 * The repository's stack: what GitHub must hold so the deploy workflow can run. Three environments (`preview`,
 * `staging` and `production`), a Cloudflare token for production's account and one for the previews' (staging runs
 * there too, decision I4), production's model key and sign-up list (I5, I8), the rule that `main` takes a change only
 * through a pull request whose check passed, with an admin bypass (I7), and the release rules (decision "releases and
 * deploys"): only an admin creates, moves or deletes a `v*` tag, and a `release/*` branch is never rewritten.
 *
 * Deployed from a workstation only, by the repository's owner: `bunx alchemy deploy
 * packages/infra/src/GitHub.stack.ts --stage prod`. The model key and the previews' password are asked of 1Password
 * by the stack itself, from the references in `env/op.env`, for that one run (`OpReferences.secrets.ts`). No workflow
 * deploys it: a job that could rewrite its own approval rule would have none.
 *
 * Must not break: a preview or staging job holds no model key, no sign-up list and no token for production's
 * account; the previews' password is written as a secret and never printed; only a run whose ref is `main` may use
 * the `production` environment, and nothing reaches production without its reviewer approving that run.
 *
 * Known, and Benjamin's choice of 2026-11-22 ("Keep sharing, say so"): staging shares the previews' Cloudflare
 * token and account. A token covers a whole account, and a pull request's run uses the pull request's own copy of
 * the workflow, so anyone who can push a branch to this repository can change or remove staging. The `staging`
 * environment's rule says which run may use that environment, not who can reach the stage. Staging holds test
 * accounts only and no model key.
 *
 * @packageDocumentation
 */
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as GitHub from "@alchemy.run/github"
import * as Alchemy from "alchemy"
import * as Secrets from "alchemy/Secrets"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import { InfraStage } from "./InfraStage.context.ts"
import { secretNamesOf } from "./OpReferences.rules.ts"
import { opEnvReferences } from "./OpReferences.secrets.ts"
import {
  givenTestPassword,
  modelKeyFor,
  planFor,
  previewPasswordVariable,
  withoutModelKeyFlag
} from "./StagePlan.rules.ts"

/** The repository the deploy workflow runs in. */
const repository = { owner: "kriegcloud", repository: "inventory-import" } as const

/** The secrets this stack writes to GitHub, by variable: production's (its model key) and the previews' password. */
const repositorySecrets: ReadonlyArray<string> = [
  ...Result.match(planFor("prod"), { onFailure: () => [], onSuccess: secretNamesOf }),
  previewPasswordVariable
]

/**
 * The names of the jobs in `.github/workflows/ci.yml` that a pull request must pass: the checks, tests and build, and
 * the job that proves and searches the review's model. The second is required too because the first no longer runs
 * the model's proofs: without it a pull request that breaks a proved rule, or adds a rule the lock does not list,
 * could be merged while that job was red. Renaming either job there blocks every merge until this is deployed again.
 */
const requiredChecks = ["Check, test and build", "Proofs and search of the model"] as const

/** GitHub's id of the repository role "admin", the one actor that may bypass the rule on `main`. */
const adminRole = 5

/**
 * What a deploy job may do in one account: the Worker and its assets, the database, and the state store's secrets.
 * Unverified until the first apply; a missing group shows as a refused call naming it.
 */
const account = (accountId: string): Cloudflare.ApiToken.Policy => ({
  effect: "allow",
  permissionGroups: [
    "Account Settings Read",
    "Workers Scripts Write",
    "D1 Write",
    "Secrets Store Write",
    "Workers Tail Read"
  ],
  resources: { [`com.cloudflare.api.account.${accountId}`]: "*" }
})

/** What production's job needs on top: to attach the one host name on the zone. Every zone in the account. */
const zones = (accountId: string): Cloudflare.ApiToken.Policy => ({
  effect: "allow",
  permissionGroups: ["Zone Read", "Workers Routes Write", "DNS Write"],
  resources: { [`com.cloudflare.api.account.${accountId}`]: { "com.cloudflare.api.account.zone.*": "*" } }
})

/**
 * The repository's settings: `bunx alchemy deploy packages/infra/src/GitHub.stack.ts --stage prod`, from a
 * workstation.
 *
 * @category stacks
 */
export default Alchemy.Stack(
  "inventory-github",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
    // This stack writes production's model key and the previews' password to GitHub, so it asks 1Password for
    // both, whichever of them `env/op.env` gives a reference for. A `.env` at the root is still read first.
    secrets: [Secrets.DotEnv(), opEnvReferences(() => repositorySecrets)]
  },
  Effect.gen(function* () {
    // Asked for so that an unknown stage name stops this stack too; the repository has one set of settings.
    yield* InfraStage

    const productionAccount = yield* Config.String("PRODUCTION_CLOUDFLARE_ACCOUNT_ID")
    const previewAccount = yield* Config.String("PREVIEW_CLOUDFLARE_ACCOUNT_ID")
    const approver = yield* Config.String("PRODUCTION_APPROVER")
    const signUp = yield* Config.String("SIGN_UP").pipe(Config.withDefault("closed"))
    // Production's plan says where its model key comes from. With none given this stack stops, as production's own
    // deploy would, unless the flag says a deploy without a model is meant; the flag is then handed on to it.
    const prod = yield* Result.match(planFor("prod"), { onFailure: Effect.die, onSuccess: Effect.succeed })
    const given = yield* Config.Redacted("OPENROUTER_API_KEY").pipe(
      Config.option,
      Config.map(O.filter((value) => value.pipe(Redacted.value, Str.trim) !== ""))
    )
    const onPurpose = yield* Config.String(withoutModelKeyFlag).pipe(Config.withDefault(""))
    const withoutOnPurpose = onPurpose === "true"
    const modelKey = yield* Result.match(
      modelKeyFor({ stage: prod.stage, source: prod.modelKey, key: given, withoutOnPurpose }),
      { onFailure: Effect.die, onSuccess: Effect.succeed }
    )

    // The one password every preview's test accounts take (decision "infra, a preview's password"). Without it no
    // preview could be signed in to, so this stack stops as a preview's own deploy would.
    const givenPreviewPassword = yield* Config.Redacted(previewPasswordVariable).pipe(
      Config.option,
      Config.map(O.filter((value) => value.pipe(Redacted.value, Str.trim) !== ""))
    )
    const previewPassword = yield* Result.match(
      givenTestPassword({ stage: "pr-<number>", given: givenPreviewPassword }),
      { onFailure: Effect.die, onSuccess: Effect.succeed }
    )

    // Production deploys after CI passed on a release branch whose head carries its tag (decisions "releases and
    // deploys"). The deploy workflow is started for that by CI's completed run, which GitHub runs from main: this
    // workflow file as main has it, with main as the run's ref. So only main may deploy to this environment: a pull
    // request's or a pushed branch's own copy of the workflow is refused here before anyone is asked to approve, and
    // the release branch brings neither the workflow nor its guard. Then the reviewer approves each deploy.
    const production = yield* GitHub.Environment("Production", {
      ...repository,
      name: "production",
      reviewers: { users: [approver] },
      deploymentBranchPolicy: { customBranchPolicies: ["main"] }
    })
    const preview = yield* GitHub.Environment("Preview", { ...repository, name: "preview" })
    // Main's head, deployed when its check passed. Only a run for main may use this environment; its token is the
    // previews', though, so that rule does not keep a pull request's run from reaching staging (see the header).
    const staging = yield* GitHub.Environment("Staging", {
      ...repository,
      name: "staging",
      deploymentBranchPolicy: { customBranchPolicies: ["main"] }
    })

    const productionToken = yield* Cloudflare.ApiToken.AccountApiToken("ProductionDeployToken", {
      accountId: productionAccount,
      policies: [account(productionAccount), zones(productionAccount)]
    })
    const previewToken = yield* Cloudflare.ApiToken.AccountApiToken("PreviewDeployToken", {
      accountId: previewAccount,
      policies: [account(previewAccount)]
    })

    yield* GitHub.Secret("ProductionCloudflareToken", {
      ...repository,
      environment: production,
      name: "CLOUDFLARE_API_TOKEN",
      value: productionToken.value
    })
    yield* GitHub.Variable("ProductionCloudflareAccount", {
      ...repository,
      environment: production,
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: productionAccount
    })
    yield* GitHub.Variable("ProductionSignUp", {
      ...repository,
      environment: production,
      name: "SIGN_UP",
      value: signUp
    })
    yield* GitHub.Variable("ProductionWithoutModelKey", {
      ...repository,
      environment: production,
      name: withoutModelKeyFlag,
      value: O.isNone(modelKey) && withoutOnPurpose ? "true" : "false"
    })
    if (O.isSome(modelKey)) {
      yield* GitHub.Secret("ProductionModelKey", {
        ...repository,
        environment: production,
        name: "OPENROUTER_API_KEY",
        value: modelKey.value
      })
    }

    yield* GitHub.Secret("PreviewCloudflareToken", {
      ...repository,
      environment: preview,
      name: "CLOUDFLARE_API_TOKEN",
      value: previewToken.value
    })
    yield* GitHub.Secret("PreviewTestAccountPassword", {
      ...repository,
      environment: preview,
      name: previewPasswordVariable,
      value: previewPassword
    })
    yield* GitHub.Variable("PreviewCloudflareAccount", {
      ...repository,
      environment: preview,
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: previewAccount
    })

    // Staging runs on the previews' account with the previews' token, and its test accounts take their password.
    yield* GitHub.Secret("StagingCloudflareToken", {
      ...repository,
      environment: staging,
      name: "CLOUDFLARE_API_TOKEN",
      value: previewToken.value
    })
    yield* GitHub.Secret("StagingTestAccountPassword", {
      ...repository,
      environment: staging,
      name: previewPasswordVariable,
      value: previewPassword
    })
    yield* GitHub.Variable("StagingCloudflareAccount", {
      ...repository,
      environment: staging,
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: previewAccount
    })

    // Decision I7: the rule on main, as code, with the admin bypass that is the way out of a check that never ran.
    yield* GitHub.Ruleset("Main", {
      ...repository,
      name: "main",
      target: "branch",
      enforcement: "active",
      conditions: { include: ["~DEFAULT_BRANCH"] },
      bypassActors: [{ actorType: "RepositoryRole", actorId: adminRole, bypassMode: "always" }],
      pullRequest: { requiredApprovingReviewCount: 0 },
      requiredStatusChecks: {
        checks: [{ context: requiredChecks[0] }, { context: requiredChecks[1] }],
        strictRequiredStatusChecksPolicy: false
      },
      deletion: true,
      nonFastForward: true
    })

    // Decision "releases and deploys": a release tag is what deploys production, so only an admin may make, move
    // or delete one; a release branch keeps its history, since its tags point into it.
    yield* GitHub.Ruleset("ReleaseTags", {
      ...repository,
      name: "release tags",
      target: "tag",
      enforcement: "active",
      conditions: { include: ["refs/tags/v*"] },
      bypassActors: [{ actorType: "RepositoryRole", actorId: adminRole, bypassMode: "always" }],
      creation: true,
      update: true,
      deletion: true
    })
    yield* GitHub.Ruleset("ReleaseBranches", {
      ...repository,
      name: "release branches",
      target: "branch",
      enforcement: "active",
      conditions: { include: ["refs/heads/release/*"] },
      bypassActors: [{ actorType: "RepositoryRole", actorId: adminRole, bypassMode: "always" }],
      deletion: true,
      nonFastForward: true
    })

    return {
      environments: ["preview", "staging", "production"],
      modelKey: O.isSome(modelKey) ? "written to production" : "none, on purpose: production's rules answer",
      signUp
    }
    // The stack is the entry point the CLI runs: this is where its one layer is provided.
    // @effect-diagnostics-next-line strictEffectProvide:off
  }).pipe(Effect.provide(InfraStage.layer))
)
