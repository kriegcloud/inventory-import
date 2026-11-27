/**
 * The stage being deployed, as its plan. A stack never reads the stage's name to decide anything: it asks this one
 * service, which answers with the plan `planFor` made, and a name that is not a stage of this app stops the deploy
 * before any resource is looked at. That is what keeps a deploy without `--stage` (Alchemy would call it
 * `live_<user>`) from making anything.
 *
 * @packageDocumentation
 */
import * as Alchemy from "alchemy"
import { AlchemyContext } from "alchemy/AlchemyContext"
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
 * A personal stage's stack was started by something other than `alchemy dev` on a person's own machine: a deploy,
 * a plan or a destroy, or a stage that is not `dev_<user>`.
 *
 * @category errors
 */
export class NotOnThisMachine extends S.TaggedError<NotOnThisMachine, { readonly brand: unique symbol }>(
  $I`NotOnThisMachine`
)(
  "NotOnThisMachine",
  { stage: S.String.pipe(S.annotateKey({ description: "The name that was given" })) },
  $I.annoteError<NotOnThisMachine>("NotOnThisMachine", {
    description: "The personal stage's stack, started by anything but `alchemy dev` for a dev_<user> stage"
  })
) {
  /** What to do about it. */
  override get message(): string {
    return `The local stack runs only as \`bun run dev:alchemy\`, for a dev_<user> stage, and "${this.stage}" was started another way. It keeps its state in memory, so anything it made in an account would be lost track of. Deploy with \`bunx alchemy deploy --stage <name>\` from the root.`
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
  static readonly plan = Effect.gen(function* () {
    const stage = yield* Alchemy.Stage
    const plan = yield* Result.match(planFor(stage), { onFailure: Effect.die, onSuccess: Effect.succeed })
    if (!plan.deployed) return yield* Effect.die(StageNotDeployed.make({ stage }))
    return plan
  })

  /**
   * The plan of a personal stage, for the trial of `alchemy dev` and nothing else: the stage is `dev_<user>` and
   * the command is `alchemy dev`, or it is a defect. The reverse of `plan`, which refuses a personal stage.
   */
  static readonly personal = Effect.gen(function* () {
    const stage = yield* Alchemy.Stage
    const { dev } = yield* AlchemyContext
    const plan = yield* Result.match(planFor(stage), { onFailure: Effect.die, onSuccess: Effect.succeed })
    if (plan.deployed || !dev) return yield* Effect.die(NotOnThisMachine.make({ stage }))
    return plan
  })

  /** The plan as a layer, for a test that builds it on its own. A stack is given it with `provided`. */
  static readonly layer = Layer.effect(InfraStage, InfraStage.plan)

  /** Gives a stack's program the plan of the stage it deploys: each stack is an entry point the CLI runs. */
  static readonly provided = Effect.provideServiceEffect(InfraStage, InfraStage.plan)
}
