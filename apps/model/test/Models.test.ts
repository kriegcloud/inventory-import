// The model's Worker put together in memory (tests-08): the Layer the Worker exports apart from its platform
// (`modelsOn`: each model's `layer` with its real handler Layers, each view's `validate`), given `Domain.InMemory` and
// built, with each served Api yielded once in process, so a model put together wrong dies here, with its reason by
// name, and not on a page. And how the Worker hosts the usage model (host-12): it takes over no Durable Object class
// from before Domain version 0. What it does not hold: the Durable Objects host, a missing workflow engine (the memory
// host brings its own) and the classes a deploy declares (the harness test's).
import * as Domain from "@alchemy.run/domain"
import { DefinitionError, WriterKeyMismatch } from "@alchemy.run/domain/DefinitionError"
import { describe, expect, it } from "@effect/vitest"
import { Allowance, CallTaken } from "@inventory/usage-model/Allowance"
import { UsageMemberApi } from "@inventory/usage-model/MemberApi"
import { UsageServerApi } from "@inventory/usage-model/ServerApi"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as HashSet from "effect/HashSet"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Ref from "effect/Ref"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { modelsOn } from "../src/Models.ts"
import { UsageHosted, usageLayerOptions } from "../src/UsageHost.ts"
import { PeopleStillIn } from "./support/binding.ts"

/** Every served Api of the Worker, yielded once in process on the services `layer` builds. */
const servedOn = <A, E, R>(layer: Layer.Layer<A, E, R>) =>
  layer.pipe(
    Layer.build,
    Effect.flatMap((services) =>
      Effect.gen(function* () {
        yield* UsageServerApi.clientInProcess
        yield* UsageMemberApi.clientInProcess
      }).pipe(Effect.provideContext(services))
    ),
    Effect.scoped
  )

/** Why a build died, as a person reads it: the `Cause` printed, a `DefinitionError`'s reason by name. */
const whyOf = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.match(exit, { onFailure: (cause) => Cause.pretty(cause), onSuccess: () => "built" })

/** A trial entry of a stream keyed by text, not by the allowance. */
class TakenNoted extends Domain.Event("TakenNoted", { day: S.Int }, { description: "A call noted, by day" }) {}

/** A trial stream keyed by text. */
class TakenLog extends Domain.Stream(
  "TakenLog",
  { key: S.String, entries: [TakenNoted] },
  { description: "Trial: a stream keyed by text" }
) {}

/** A trial projection keyed by the allowance that writes the stream keyed by text: the mistake the build refuses. */
class TakenWriter extends Domain.Projection(
  "TakenWriter",
  { from: [Allowance], key: Allowance, on: [CallTaken], writes: [TakenLog] },
  { description: "Trial: a projection keyed otherwise than the stream it writes" }
) {}

/** A trial model put together wrong. */
class Trial extends Domain.Model(
  "Trial",
  { aggregates: [Allowance], projections: [TakenWriter], streams: [TakenLog] },
  { description: "Trial: a model whose projection is keyed otherwise than its stream" }
) {}

const TrialWriterLive = TakenWriter.toLayer(Effect.succeed(Effect.fn("TakenWriter.write")(function* () {})))

describe("the model's Worker, put together in memory", () => {
  it.effect(
    "builds every model it hosts and serves each of their Apis",
    Effect.fnUntraced(function* () {
      const exit = yield* servedOn(modelsOn({ platform: Domain.InMemory, sessions: PeopleStillIn })).pipe(Effect.exit)
      expect(whyOf(exit)).toBe("built")
    })
  )

  it.effect(
    "dies with the reason by name when a projection is keyed otherwise than the stream it writes",
    Effect.fnUntraced(function* () {
      const exit = yield* Trial.layer(TrialWriterLive).pipe(
        Layer.provide(Domain.InMemory),
        Layer.build,
        Effect.scoped,
        Effect.exit
      )
      // The printed Cause says what is wrong, and the defect names the reason: a `DefinitionError` whose `reason` is it.
      expect(whyOf(exit)).toContain("Projection TakenWriter is keyed by Allowance, so it cannot write TakenLog")
      const defect = Exit.findDefect(exit).pipe(Result.getSuccess)
      expect(
        O.exists(defect, (error) => error instanceof DefinitionError && error.reason instanceof WriterKeyMismatch)
      ).toBe(true)
    })
  )
})

describe("how the Worker hosts the usage model", () => {
  it("takes over no earlier Durable Object class: its classes are its own", () => {
    expect(usageLayerOptions.legacyData).toBe(false)
  })

  it.effect(
    "tells its platform so, which then gives no class a former name",
    Effect.fnUntraced(function* () {
      const told = yield* Ref.make(HashSet.empty<string>())
      // The memory host, with every model it is told to host written down as its name and whether it takes over data.
      const recording = Layer.effect(
        Domain.Platform,
        Effect.gen(function* () {
          const platform = yield* Domain.Platform
          return Domain.Platform.of({
            ...platform,
            model: Effect.fn("Domain.Platform.model")(function* (model) {
              yield* Ref.update(told, HashSet.add(`${model.modelName} legacyData=${model.legacyData}`))
              return yield* platform.model(model)
            })
          })
        })
      )
      yield* UsageHosted.pipe(
        Layer.provide(PeopleStillIn),
        Layer.provide(recording),
        Layer.provide(Domain.InMemory),
        Layer.build,
        Effect.scoped
      )
      const hosted = yield* Ref.get(told)
      expect(hosted).toEqual(HashSet.make("Usage legacyData=false"))
    })
  )
})
