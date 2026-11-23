// The day's model calls over the in-memory store, as calls arrive in time: no 24 hours ever hold more taken calls
// than the limit, and a call is refused only when the 24 hours before it already hold that many. The window is the
// store's to work out from the moment of the call; nothing a caller passes can widen it.
import { expect, layer } from "@effect/vitest"
import { AllowanceStore, CallMoment, Reservation } from "@inventory/access-model/AllowanceStore"
import { AccessMemoryRef, accessMemory } from "@inventory/access-model/Memory"
import { OrganizationId } from "@inventory/kernel/Ids"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import * as Ref from "effect/Ref"
import * as S from "effect/Schema"

const day = 24 * 60 * 60 * 1000

/** When a call arrives, in milliseconds after the first: three days of them, so windows overlap and roll over. */
const After = S.Int.check(S.isBetween({ minimum: 0, maximum: 3 * day }))
/** A small limit, so a burst of calls reaches it. */
const Limit = S.Int.check(S.isBetween({ minimum: 1, maximum: 8 }))
const Arrival = S.Struct({ call: Reservation, after: After })
const Burst = S.Struct({
  organization: OrganizationId,
  limit: Limit,
  arrivals: S.NonEmptyArray(Arrival).check(S.isMaxLength(40))
})

// The burst's three days all fall where a call can be taken: not in the last three days before year 10000.
const aBurst = Arbitrary.filter(Arbitrary.schema(Burst), (burst) =>
  S.is(CallMoment)(DateTime.add(A.headNonEmpty(burst.arrivals).call.at, { milliseconds: 3 * day }))
)

/** A day full of calls, then two more: one exactly 24 hours after the first, one a millisecond later. */
const FullDay = S.Struct({
  limit: Limit,
  filling: S.NonEmptyArray(Reservation).check(S.isMaxLength(8)),
  onTheEdge: Reservation,
  pastIt: Reservation
})
const aFullDay = Arbitrary.filter(Arbitrary.schema(FullDay), (full) => {
  const all = [...full.filling, full.onTheEdge, full.pastIt]
  return (
    full.filling.length >= full.limit &&
    S.is(CallMoment)(DateTime.add(A.headNonEmpty(full.filling).at, { milliseconds: day + 1 })) &&
    A.dedupe(A.map(all, (call) => call.id)).length === all.length
  )
})

/** The taken calls among the first `upTo` that fall in the 24 hours up to `at`. */
const takenWithin = (
  answers: ReadonlyArray<{ readonly at: number; readonly taken: boolean }>,
  upTo: number,
  at: number
): number => A.filter(A.take(answers, upTo), (answer) => answer.taken && answer.at >= at - day).length

layer(accessMemory())("the allowance's window", (it) => {
  it.effect.prop(
    "no day holds more taken calls than the limit, and a call is refused only when the day before it is full",
    [aBurst],
    ([burst]) =>
      Effect.gen(function* () {
        const memory = yield* AccessMemoryRef
        yield* Ref.update(memory, (state) => ({ ...state, calls: [] }))
        const store = yield* AllowanceStore
        const first = A.headNonEmpty(burst.arrivals).call.at
        const ordered = A.sort(
          burst.arrivals,
          Order.mapInput(Order.Number, (arrival: typeof Arrival.Type) => arrival.after)
        )
        const answers = yield* Effect.forEach(
          ordered,
          (arrival) => {
            const at = DateTime.add(first, { milliseconds: arrival.after })
            const reservation = Reservation.make({
              ...arrival.call,
              organization: burst.organization,
              at,
              limit: burst.limit
            })
            return Effect.map(store.take(reservation), (taken) => ({ at: DateTime.toEpochMillis(at), taken }))
          },
          { concurrency: 1 }
        )
        A.forEach(answers, (answer, index) => {
          if (answer.taken) expect(takenWithin(answers, index + 1, answer.at)).toBeLessThanOrEqual(burst.limit)
          else expect(takenWithin(answers, index, answer.at)).toBeGreaterThanOrEqual(burst.limit)
        })
      }),
    { arbitrary: { runs: 200 } }
  )

  it.effect.prop(
    "the day before a call is the 24 hours up to it: a call taken exactly 24 hours earlier still counts, one a millisecond more does not",
    [aFullDay],
    ([full]) =>
      Effect.gen(function* () {
        const memory = yield* AccessMemoryRef
        yield* Ref.update(memory, (state) => ({ ...state, calls: [] }))
        const store = yield* AllowanceStore
        const start = A.headNonEmpty(full.filling).at
        const at = (call: Reservation, after: number) =>
          Reservation.make({
            ...call,
            organization: A.headNonEmpty(full.filling).organization,
            at: DateTime.add(start, { milliseconds: after }),
            limit: full.limit
          })
        // The limit's calls, all at the first moment: the day before it is full.
        const filled = yield* Effect.forEach(A.take(full.filling, full.limit), (call) => store.take(at(call, 0)), {
          concurrency: 1
        })
        expect(A.every(filled, (taken) => taken)).toBe(true)
        const edge = yield* store.take(at(full.onTheEdge, day))
        const past = yield* store.take(at(full.pastIt, day + 1))
        expect([edge, past]).toEqual([false, true])
      }),
    { arbitrary: { runs: 100 } }
  )
})
