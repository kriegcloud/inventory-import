// A model small enough to hold the kit's model atoms to their word, declared here because this package may not import a
// context's model (the boundaries law): one aggregate with a command and one that dies, one view with a middleware and a rejection,
// and the Api over them. Nothing in the app is shaped like it; it stands for any model's Api.
import * as Domain from "@alchemy.run/domain"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"
import * as S from "effect/Schema"

export const CounterId = S.String.pipe(S.brand("CounterId")).annotate({ description: "The counter one row is about" })
export type CounterId = typeof CounterId.Type

/** One counter per test, so no test reads another's. */
export const CounterIds = {
  press: CounterId.make("c-press"),
  resend: CounterId.make("c-resend"),
  shared: CounterId.make("c-shared"),
  refused: CounterId.make("c-refused"),
  switched: CounterId.make("c-switch"),
  judged: CounterId.make("c-judged"),
  asked: CounterId.make("c-asked"),
  kept: CounterId.make("c-kept"),
  left: CounterId.make("c-left"),
  forgotten: CounterId.make("c-forgotten"),
  forgottenLooked: CounterId.make("c-forgotten-looked"),
  expired: CounterId.make("c-expired"),
  returned: CounterId.make("c-returned"),
  unsigned: CounterId.make("c-unsigned"),
  unsignedToo: CounterId.make("c-unsigned-too"),
  lost: CounterId.make("c-lost")
} as const

export class Bumped extends Domain.Event("Bumped", {
  total: S.Int.annotateKey({ description: "The counter's total after it" })
}) {}

export class Bump extends Domain.Command("Bump", {
  input: {
    counterId: CounterId.annotateKey({ description: "The counter it adds to" }),
    by: S.Int.annotateKey({ description: "How much it adds" })
  },
  events: [Bumped]
}) {}

/** A command whose handler has a bug: it dies, which the model's server answers with its one undeclared failure. */
export class Break extends Domain.Command("Break", {
  input: { counterId: CounterId.annotateKey({ description: "The counter it is sent to" }) },
  events: [Bumped]
}) {}

const Total = S.Struct({ total: S.Int.annotateKey({ description: "The sum of every bump" }) }).annotate({
  description: "A counter's total"
})

export class Counter extends Domain.Aggregate("Counter", {
  id: CounterId,
  state: Total,
  initial: { total: 0 },
  commands: [Bump, Break],
  keyOf: (command) => command.counterId,
  decide: {
    Bump: (counter, command) => [Bumped.make({ total: counter.total + command.by })],
    Break: () => Effect.die(new Error("Cannot read properties of undefined (reading 'total') at Counter.ts:12"))
  },
  evolve: { Bumped: (_, event) => ({ total: event.total }) }
}) {}

/** The view's refusal: a total over a hundred is not shown to anyone. */
export class TooHigh extends Domain.Rejection("TooHigh") {}

/** The reads' middleware: it lets everyone in, counts how often it judged, and may say how long its verdict holds. */
export class Judged extends RpcMiddleware.Service<Judged>()("@inventory/client/test/Counting.fixture/Judged") {}

export class CounterTotal extends Domain.View("CounterTotal", {
  from: [Counter],
  key: Counter,
  middleware: [Judged],
  rejects: [TooHigh],
  state: Total,
  initial: { total: 0 },
  evolve: { Bumped: (_, event) => ({ total: event.total }) }
}) {}

/** Who may read a key: anyone, until its total passes a hundred. */
export const CounterTotalLive = CounterTotal.toLayer(
  Effect.succeed(
    Effect.fn(function* (_request, counter) {
      if (O.exists(O.fromNullishOr(counter), (counter) => counter.total > 100)) return yield* TooHigh.make()
    })
  )
)

export class Counting extends Domain.Model("Counting", { aggregates: [Counter], views: [CounterTotal] }) {}

export class CountingApi extends Domain.Api("CountingApi", { model: Counting }) {}

/** The model hosted in memory, as one Layer for every client a test connects. */
export const CountingHost = Counting.layer(CounterTotalLive).pipe(Layer.provide(Domain.InMemory))

/**
 * The middleware's server half: `judged` counts each time it ran, and `holds` (when given) is how long its verdict
 * holds, so a live read open longer is closed by the server and judged again.
 */
export const judging = (holds: O.Option<Duration.Duration>) => {
  const judged = MutableRef.make(0)
  const layer = Layer.succeed(
    Judged,
    Effect.fn(function* (effect) {
      // Judged a moment after it is asked, as a server's session lookup is: a read's first state never comes at once.
      yield* Effect.sleep("5 millis")
      MutableRef.update(judged, (count) => count + 1)
      yield* O.match(holds, {
        onNone: () => Effect.void,
        onSome: (holds) =>
          Effect.flatMap(Clock.currentTimeMillis, (now) => Domain.setExpiry(now + Duration.toMillis(holds)))
      })
      return yield* effect
    })
  )
  return { judged, layer }
}
