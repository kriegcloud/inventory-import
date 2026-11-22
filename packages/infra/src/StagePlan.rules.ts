/**
 * The plan of a stage, from its name. This is the one place that says what differs between stages, as Benjamin
 * decided it (decisions "infra I4", "I5" and "I8"): production alone answers at the real address and holds a model
 * key; it is never seeded; a preview and a test stage live on `workers.dev` with the test accounts and no sign-up, so
 * no real email is ever stored outside production; production takes the owner's list. Staging, main's head once its check passed
 * (decision "releases and deploys"), is a rehearsal the same way: the test accounts, sign-up closed, and no model key,
 * since decision I5 gives one to production only. A name that is none of the five kinds is refused, `live_<user>`
 * among them, which is what a deploy without `--stage` would use.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import {
  FromEnvironment,
  NotGiven,
  OnHostname,
  OnWorkersDev,
  StagePlan,
  type SettingSource,
  StageKind,
  type TestPassword
} from "./Stage.schema.ts"
import { $InfraId } from "./internal/identity.ts"

const $I = $InfraId.create("StagePlan")

/**
 * The address people open production at, and the zone it is on.
 *
 * @category constants
 */
export const production = { hostname: "inventory.beep-effect.com", zone: "beep-effect.com" } as const

/**
 * The stage name is none of: `prod`, `staging`, `pr-<number>`, `test_<user>`, `dev_<user>`.
 *
 * @category errors
 */
export class UnknownStage extends S.TaggedError<UnknownStage, { readonly brand: unique symbol }>($I`UnknownStage`)(
  "UnknownStage",
  { stage: S.String.pipe(S.annotateKey({ description: "The name that was given" })) },
  $I.annoteError<UnknownStage>("UnknownStage", { description: "A stage name that is none of the five kinds" })
) {
  /** What to do about it. */
  override get message(): string {
    return `"${this.stage}" is not a stage of this app. Name one with --stage: prod, staging, pr-<number>, test_<user> or dev_<user>.`
  }
}

const kinds: ReadonlyArray<readonly [RegExp, StageKind]> = [
  [/^prod$/, "production"],
  [/^staging$/, "staging"],
  [/^pr-[1-9][0-9]{0,8}$/, "preview"],
  [/^test_[a-z0-9][-_a-z0-9]{0,40}$/, "test"],
  [/^dev_[a-z0-9][-_a-z0-9]{0,40}$/, "personal"]
]

/**
 * What kind of stage a name is, when it is one.
 *
 * @example kindOf("pr-42") // Result.succeed("preview")
 * @example kindOf("live_ben") // Result.fail(UnknownStage)
 */
export const kindOf = (stage: string): Result.Result<StageKind, UnknownStage> => {
  for (const [pattern, kind] of kinds) if (pattern.test(stage)) return Result.succeed(kind)
  return Result.fail(UnknownStage.make({ stage }))
}

const nowhere = NotGiven.make({})

/**
 * The plan of a stage.
 *
 * @example planFor("prod") // production: inventory.beep-effect.com, no seed, OPENROUTER_API_KEY and SIGN_UP from the environment
 * @example planFor("pr-42") // preview: workers.dev, the test organizations and accounts, sign-up closed, no model key
 */
export const planFor = (stage: string): Result.Result<StagePlan, UnknownStage> =>
  Result.map(kindOf(stage), (kind) => {
    // A stage that is not production: the test organizations and accounts, sign-up closed, no model key.
    const rehearsal = (deployed: boolean): StagePlan =>
      StagePlan.make({
        stage,
        kind,
        address: OnWorkersDev.make({}),
        seeds: ["organizations", "accounts"],
        modelKey: nowhere,
        signUp: nowhere,
        deployed
      })
    return StageKind.match(kind, {
      production: () =>
        StagePlan.make({
          stage,
          kind,
          address: OnHostname.make(production),
          seeds: [],
          modelKey: FromEnvironment.make({ variable: "OPENROUTER_API_KEY" }),
          signUp: FromEnvironment.make({ variable: "SIGN_UP" }),
          deployed: true
        }),
      preview: () => rehearsal(true),
      staging: () => rehearsal(true),
      test: () => rehearsal(true),
      personal: () => rehearsal(false)
    })
  })

/**
 * The variable a preview's deploy reads the previews' one test-account password from.
 *
 * @category constants
 */
export const previewPasswordVariable = "PREVIEW_TEST_ACCOUNT_PASSWORD"

/**
 * Where a stage's test accounts get their password. The password written in the repository opens them only on a
 * developer's own machine (decision "infra, the test accounts' password"). A test stage, deployed by hand, mints
 * its own. A preview, deployed by a workflow whose log is public, is given the one password every preview shares,
 * which its reviewer already holds (decision "infra, a preview's password"); staging, deployed the same way, takes
 * that same password.
 *
 * @example testPasswordOf(planOfPreview) // "given"
 * @example testPasswordOf(planOfStaging) // "given"
 * @example testPasswordOf(planOfTestStage) // "minted"
 * @example testPasswordOf(planOfProduction) // "none": it has no test account
 */
export const testPasswordOf = (plan: StagePlan): TestPassword => {
  if (!plan.deployed || !A.contains(plan.seeds, "accounts")) return "none"
  return plan.kind === "preview" || plan.kind === "staging" ? "given" : "minted"
}

/**
 * A preview was deployed without the password its test accounts take.
 *
 * @category errors
 */
export class MissingPreviewPassword extends S.TaggedError<MissingPreviewPassword, { readonly brand: unique symbol }>(
  $I`MissingPreviewPassword`
)(
  "MissingPreviewPassword",
  {
    stage: S.String.pipe(S.annotateKey({ description: "The stage being deployed" })),
    variable: S.String.pipe(S.annotateKey({ description: "The variable that should hold the password" }))
  },
  $I.annoteError<MissingPreviewPassword>("MissingPreviewPassword", {
    description: "A preview deployed without the one password its test accounts take"
  })
) {
  /** What is missing and where its reference is written. */
  override get message(): string {
    return (
      `Stage "${this.stage}" has no password for its test accounts: ${this.variable} is not set, so nobody could ` +
      `sign in to this ${this.stage === "staging" ? "stage" : "preview"}. Write the reference ` +
      `${this.variable}=op://<vault>/<item>/<field> in packages/infra/env/op.env and deploy the repository's stack, ` +
      `which asks 1Password for it and gives the password to the ${this.stage === "staging" ? "staging" : "preview"} ` +
      `environment as a secret.`
    )
  }
}

/**
 * The password a preview's test accounts take: the one it was given, or the deploy stops. None is ever minted for a
 * preview, because nothing could carry a minted one to its reviewer without printing it.
 *
 * @example givenTestPassword({ stage: "pr-42", given: O.none() }) // Result.fail(MissingPreviewPassword)
 */
export const givenTestPassword = <Password>(input: {
  readonly stage: string
  readonly given: O.Option<Password>
}): Result.Result<Password, MissingPreviewPassword> =>
  O.match(input.given, {
    onNone: () => Result.fail(MissingPreviewPassword.make({ stage: input.stage, variable: previewPasswordVariable })),
    onSome: Result.succeed
  })

/**
 * The variable of the Cloudflare token every preview's and staging's deploy job takes: the owner's own account-owned
 * token for the previews' account (Benjamin, 2026-11-22: "Use my own token"), which the repository's stack writes to
 * GitHub and never mints.
 *
 * @category constants
 */
export const previewTokenVariable = "PREVIEW_CLOUDFLARE_API_TOKEN"

/**
 * The variable of the previews' Cloudflare account id, kept beside that token.
 *
 * @category constants
 */
export const previewAccountVariable = "PREVIEW_CLOUDFLARE_ACCOUNT_ID"

/**
 * The repository's stack was deployed without the token the previews' and staging's jobs deploy with.
 *
 * @category errors
 */
export class MissingPreviewToken extends S.TaggedError<MissingPreviewToken, { readonly brand: unique symbol }>(
  $I`MissingPreviewToken`
)(
  "MissingPreviewToken",
  { variable: S.String.pipe(S.annotateKey({ description: "The variable that should hold the token" })) },
  $I.annoteError<MissingPreviewToken>("MissingPreviewToken", {
    description: "The repository's stack deployed without the Cloudflare token previews and staging deploy with"
  })
) {
  /** What is missing and where its reference is written. */
  override get message(): string {
    return (
      `The repository's stack has no Cloudflare token for previews and staging: ${this.variable} is not set, so no ` +
      `pull request could get a preview and main could not reach staging. Write the references ` +
      `${this.variable}="op://<vault>/<item>/<field>" and ${previewAccountVariable}="op://<vault>/<item>/<field>" ` +
      `in packages/infra/env/op.env.local (git ignores it) and deploy the stack again; it asks 1Password for both. ` +
      `If they are written there already, ${this.variable} is exported empty in your shell or the root .env, and an ` +
      `empty one wins over 1Password's answer: unset it.`
    )
  }
}

/**
 * The token the previews' and staging's jobs deploy with: the one the owner gave, or the stack stops. None is minted,
 * because the login this stack is deployed with does not reach the previews' account.
 *
 * @example givenPreviewToken(O.none()) // Result.fail(MissingPreviewToken)
 */
export const givenPreviewToken = <Token>(given: O.Option<Token>): Result.Result<Token, MissingPreviewToken> =>
  O.match(given, {
    onNone: () => Result.fail(MissingPreviewToken.make({ variable: previewTokenVariable })),
    onSome: Result.succeed
  })

/**
 * The variable that deploys a stage without its model key on purpose, when set to `true`.
 *
 * @category constants
 */
export const withoutModelKeyFlag = "DEPLOY_WITHOUT_MODEL_KEY"

/**
 * A stage whose plan names a model key was deployed with none, and nobody said that was meant.
 *
 * @category errors
 */
export class MissingModelKey extends S.TaggedError<MissingModelKey, { readonly brand: unique symbol }>(
  $I`MissingModelKey`
)(
  "MissingModelKey",
  {
    stage: S.String.pipe(S.annotateKey({ description: "The stage being deployed" })),
    variable: S.String.pipe(S.annotateKey({ description: "The variable that should hold the key" }))
  },
  $I.annoteError<MissingModelKey>("MissingModelKey", {
    description: "A stage whose plan names a model key, deployed with none and without the flag that means it"
  })
) {
  /** What is missing, where it is written, and the way to deploy without it on purpose. */
  override get message(): string {
    return (
      `Stage "${this.stage}" has no model key: ${this.variable} is not set, so every model feature would be answered ` +
      `by rules. Write the reference ${this.variable}=op://<vault>/<item>/<field> in packages/infra/env/op.env and ` +
      `deploy the repository's stack, which asks 1Password for it and gives the key to the production environment. ` +
      `To deploy without a model on purpose, set ${withoutModelKeyFlag}=true.`
    )
  }
}

/**
 * The model key a stage is deployed with. A stage whose plan names none gets none, whatever the environment holds.
 * A stage whose plan names one stops without it (decision "infra, a missing model key"): a mistyped name would
 * otherwise show only as "answered by rules". The flag deploys without one on purpose.
 *
 * @example modelKeyFor({ stage: "prod", source: FromEnvironment.make({ variable: "OPENROUTER_API_KEY" }), key: O.none(), withoutOnPurpose: false }) // Result.fail(MissingModelKey)
 * @example modelKeyFor({ stage: "pr-42", source: NotGiven.make({}), key: O.some(key), withoutOnPurpose: false }) // Result.succeed(O.none())
 */
export const modelKeyFor = <Key>(input: {
  readonly stage: string
  readonly source: SettingSource
  readonly key: O.Option<Key>
  readonly withoutOnPurpose: boolean
}): Result.Result<O.Option<Key>, MissingModelKey> => {
  if (input.source.from === "nowhere") return Result.succeed(O.none())
  if (O.isSome(input.key) || input.withoutOnPurpose) return Result.succeed(input.key)
  return Result.fail(MissingModelKey.make({ stage: input.stage, variable: input.source.variable }))
}
