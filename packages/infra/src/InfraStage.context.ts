/**
 * The stage being deployed, as its plan. A stack never reads the stage's name to decide anything: it asks this one
 * service, which answers with the plan `planFor` made, and a name that is not a stage of this app stops the deploy
 * before any resource is looked at. That is what keeps a deploy without `--stage` (Alchemy would call it
 * `live_<user>`) from making anything.
 *
 * @packageDocumentation
 */
import * as Alchemy from "alchemy"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import type { StagePlan } from "./Stage.schema.ts"
import { planFor } from "./StagePlan.rules.ts"
import { $InfraId } from "./internal/identity.ts"

const $I = $InfraId.create("InfraStage")

/**
 * The stage is one of this app's, but it runs on a person's own machine and is never deployed.
 *
 * @category errors
 */
export class StageNotDeployed extends S.TaggedError<StageNotDeployed, { readonly brand: unique symbol }>(
  $I`StageNotDeployed`
)(
  "StageNotDeployed",
  { stage: S.String.pipe(S.annotateKey({ description: "The name that was given" })) },
  $I.annoteError<StageNotDeployed>("StageNotDeployed", {
    description: "A personal stage, which runs on a person's own machine and is never deployed"
  })
) {
  /** What to do about it. */
  override get message(): string {
    return `"${this.stage}" is a personal stage: it runs with \`bun run dev\` and is never deployed. Deploy prod, staging, pr-<number> or test_<user>.`
  }
}

/**
 * The plan of the stage being deployed.
 *
 * @category services
 */
export class InfraStage extends Context.Service<InfraStage, StagePlan>()($I`InfraStage`) {
  /**
   * Reads Alchemy's stage name and decides its plan. An unknown name, or a personal stage, is a defect: a stack has
   * one failure a person fixes by a setting (a missing variable), and this is not one.
   */
  static readonly layer = Layer.effect(
    InfraStage,
    Effect.gen(function* () {
      const stage = yield* Alchemy.Stage
      const plan = yield* Result.match(planFor(stage), { onFailure: Effect.die, onSuccess: Effect.succeed })
      if (!plan.deployed) return yield* Effect.die(StageNotDeployed.make({ stage }))
      return plan
    })
  )
}
