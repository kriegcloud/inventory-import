// The one service the stacks ask: it hands over the plan of the stage being deployed, and stops a deploy whose
// stage is none of this app's before any resource is looked at. Also that both stacks load from the repository alone.
import { describe, expect, it } from "@effect/vitest"
import * as Alchemy from "alchemy"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as S from "effect/Schema"
import GitHubStack from "../src/GitHub.stack.ts"
import { InfraStage, StageNotDeployed } from "../src/InfraStage.context.ts"
import InventoryStack from "../src/Inventory.stack.ts"
import { UnknownStage } from "../src/StagePlan.rules.ts"

/** What building the service gives for a stage of this name: its plan, or how the deploy stops. */
const built = (stage: string) =>
  InfraStage.layer.pipe(Layer.provide(Layer.succeed(Alchemy.Stage, stage)), Layer.build, Effect.exit)

const stoppedBy = <A, E>(exit: Exit.Exit<A, E>): unknown =>
  Exit.isFailure(exit) ? Cause.squash(exit.cause) : "not stopped"

describe("InfraStage", () => {
  it.effect("gives a stack the plan of the stage being deployed", () =>
    Effect.gen(function* () {
      const exit = yield* built("pr-42")
      const plan = Exit.isSuccess(exit) ? Context.get(exit.value, InfraStage) : undefined
      expect([plan?.kind, plan?.address.at, plan?.seeds]).toEqual([
        "preview",
        "workersDev",
        ["organizations", "accounts"]
      ])
    })
  )

  it.effect("stops a deploy with no --stage, which Alchemy names live_<user>", () =>
    Effect.gen(function* () {
      const exit = yield* built("live_ben")
      const stopped = stoppedBy(exit)
      expect(S.is(UnknownStage)(stopped)).toBe(true)
      expect(S.is(UnknownStage)(stopped) ? stopped.message : "").toContain("Name one with --stage")
    })
  )

  it.effect("stops a deploy of a personal stage, which only ever runs on a person's machine", () =>
    Effect.gen(function* () {
      const exit = yield* built("dev_ben")
      expect(S.is(StageNotDeployed)(stoppedBy(exit))).toBe(true)
    })
  )

  it("both stacks load from the repository alone: no account, no login, no network", () => {
    expect([Effect.isEffect(InventoryStack), Effect.isEffect(GitHubStack)]).toEqual([true, true])
  })
})
