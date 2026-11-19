/**
 * The repository's stack: what GitHub must hold so the deploy workflow can run. Two environments (`preview` and
 * `production`), a Cloudflare token for each, minted in its own account (decision I4), production's model key and
 * sign-up list (I5, I8), and the rule that `main` takes a change only through a pull request whose check passed,
 * with an admin bypass (I7).
 *
 * Deployed from a workstation only, by the repository's owner, under `op run` so the model key is filled for that
 * one process: `op run --env-file packages/infra/env/op.env -- bunx alchemy deploy packages/infra/src/GitHub.stack.ts
 * --stage prod`. No workflow deploys it: a job that could rewrite its own approval rule would have none.
 *
 * Must not break: a preview job holds no model key, no sign-up list and no token for production's account.
 *
 * @packageDocumentation
 */
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as GitHub from "@alchemy.run/github"
import * as Alchemy from "alchemy"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import { InfraStage } from "./InfraStage.context.ts"
import { modelKeyFor, planFor, withoutModelKeyFlag } from "./StagePlan.rules.ts"

/** The repository the deploy workflow runs in. */
const repository = { owner: "kriegcloud", repository: "inventory-import" } as const

/** The name of the job in `.github/workflows/ci.yml` that a pull request must pass. */
const requiredCheck = "Check, test and build"

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
  { providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()), state: Cloudflare.state() },
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

    const production = yield* GitHub.Environment("Production", {
      ...repository,
      name: "production",
      reviewers: { users: [approver] },
      deploymentBranchPolicy: { customBranchPolicies: ["main"] }
    })
    const preview = yield* GitHub.Environment("Preview", { ...repository, name: "preview" })

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
    yield* GitHub.Variable("PreviewCloudflareAccount", {
      ...repository,
      environment: preview,
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
      requiredStatusChecks: { checks: [{ context: requiredCheck }], strictRequiredStatusChecksPolicy: false },
      deletion: true,
      nonFastForward: true
    })

    return {
      environments: ["preview", "production"],
      modelKey: O.isSome(modelKey) ? "written to production" : "none, on purpose: production's rules answer",
      signUp
    }
    // The stack is the entry point the CLI runs: this is where its one layer is provided.
    // @effect-diagnostics-next-line strictEffectProvide:off
  }).pipe(Effect.provide(InfraStage.layer))
)
