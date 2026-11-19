/**
 * The plan of a stage, from its name. This is the one place that says what differs between stages, as Benjamin
 * decided it (decisions "infra I4", "I5" and "I8"): production alone answers at the real address and holds a model
 * key; it is never seeded; a preview and a test stage live on `workers.dev`; nobody signs up anywhere but by the
 * owner's list. A name that is none of the four kinds is refused, `live_<user>` among them, which is what a deploy
 * without `--stage` would use.
 *
 * @packageDocumentation
 */
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { FromEnvironment, NotGiven, OnHostname, OnWorkersDev, StagePlan, type StageKind } from "./Stage.schema.ts"
import { $InfraId } from "./internal/identity.ts"

const $I = $InfraId.create("StagePlan")

/**
 * The address people open production at, and the zone it is on.
 *
 * @category constants
 */
export const production = { hostname: "inventory.beep-effect.com", zone: "beep-effect.com" } as const

/**
 * The stage name is none of: `prod`, `pr-<number>`, `test_<user>`, `dev_<user>`.
 *
 * @category errors
 */
export class UnknownStage extends S.TaggedError<UnknownStage, { readonly brand: unique symbol }>($I`UnknownStage`)(
  "UnknownStage",
  { stage: S.String.pipe(S.annotateKey({ description: "The name that was given" })) },
  $I.annoteError<UnknownStage>("UnknownStage", { description: "A stage name that is none of the four kinds" })
) {
  /** What to do about it. */
  override get message(): string {
    return `"${this.stage}" is not a stage of this app. Name one with --stage: prod, pr-<number>, test_<user> or dev_<user>.`
  }
}

const kinds: ReadonlyArray<readonly [RegExp, StageKind]> = [
  [/^prod$/, "production"],
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
 * @example planFor("pr-42") // preview: workers.dev, the two test organizations, no model key
 */
export const planFor = (stage: string): Result.Result<StagePlan, UnknownStage> =>
  Result.map(kindOf(stage), (kind) => {
    switch (kind) {
      case "production":
        return StagePlan.make({
          stage,
          kind,
          address: OnHostname.make(production),
          seeds: [],
          modelKey: FromEnvironment.make({ variable: "OPENROUTER_API_KEY" }),
          signUp: FromEnvironment.make({ variable: "SIGN_UP" }),
          deployed: true
        })
      case "preview":
        return StagePlan.make({
          stage,
          kind,
          address: OnWorkersDev.make({}),
          seeds: ["organizations"],
          modelKey: nowhere,
          signUp: FromEnvironment.make({ variable: "SIGN_UP" }),
          deployed: true
        })
      case "test":
        return StagePlan.make({
          stage,
          kind,
          address: OnWorkersDev.make({}),
          seeds: ["organizations", "accounts"],
          modelKey: nowhere,
          signUp: nowhere,
          deployed: true
        })
      case "personal":
        return StagePlan.make({
          stage,
          kind,
          address: OnWorkersDev.make({}),
          seeds: ["organizations", "accounts"],
          modelKey: nowhere,
          signUp: nowhere,
          deployed: false
        })
    }
  })
