// The day's model calls on D1, as calls arrive in time: the count and the taking are one statement, and the window
// it counts is the 24 hours before each call, worked out by the store. On a fresh database, for any burst of calls:
// no 24 hours hold more taken calls than the limit, and a call is refused only when the 24 hours before it are full.
import { expect, layer } from "@effect/vitest"
import { AllowanceStoreD1 } from "@inventory/access-host/AllowanceStoreD1"
import { AllowanceStore, CallMoment, Reservation } from "@inventory/access-model/AllowanceStore"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Order from "effect/Order"
import * as S from "effect/Schema"
import * as SqlClient from "effect/sql/SqlClient"
import { TestDatabase } from "./support/app.ts"

const day = 24 * 60 * 60 * 1000
// A seeded member of a seeded organization (seeds/organizations.sql): a call's foreign keys need both.
const organization = OrganizationId.make("org_prairie")
const actor = MemberId.make("mem_dana")

/** When a call arrives, in milliseconds after the first: three days of them, so windows overlap and roll over. */
const After = S.Int.check(S.isBetween({ minimum: 0, maximum: 3 * day }))
/** A small limit, so a burst of calls reaches it. */
const Limit = S.Int.check(S.isBetween({ minimum: 1, maximum: 6 }))
const Arrival = S.Struct({ call: Reservation, after: After })
const Burst = S.Struct({ limit: Limit, arrivals: S.NonEmptyArray(Arrival).check(S.isMaxLength(20)) })
// The burst's three days all fall where a call can be taken, not in the last three days before year 10000; and each
// call has its own id, as the gateway's fresh v4 ids do (the table's key refuses a second).
const aBurst = Arbitrary.filter(
  Arbitrary.schema(Burst),
  (burst) =>
    S.is(CallMoment)(DateTime.add(A.headNonEmpty(burst.arrivals).call.at, { milliseconds: 3 * day })) &&
    A.dedupe(A.map(burst.arrivals, (arrival) => arrival.call.id)).length === burst.arrivals.length
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

layer(AllowanceStoreD1.pipe(Layer.provideMerge(TestDatabase)), { timeout: "60 seconds" })(
  "the allowance's window on D1",
  (it) => {
    it.effect.prop(
      "no day holds more taken calls than the limit, and a call is refused only when the day before it is full",
      [aBurst],
      ([burst]) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          // Each run starts from no calls: what an earlier run took is not this burst's.
          yield* sql`DELETE FROM modelCall WHERE organizationId = ${organization}`
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
              const reservation = Reservation.make({ ...arrival.call, organization, actor, at, limit: burst.limit })
              return Effect.map(store.take(reservation), (taken) => ({ at: DateTime.toEpochMillis(at), taken }))
            },
            { concurrency: 1 }
          )
          A.forEach(answers, (answer, index) => {
            if (answer.taken) expect(takenWithin(answers, index + 1, answer.at)).toBeLessThanOrEqual(burst.limit)
            else expect(takenWithin(answers, index, answer.at)).toBeGreaterThanOrEqual(burst.limit)
          })
        }),
      { arbitrary: { runs: 25 } }
    )

    it.effect.prop(
      "the day before a call is the 24 hours up to it: a call taken exactly 24 hours earlier still counts, one a millisecond more does not",
      [aFullDay],
      ([full]) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`DELETE FROM modelCall WHERE organizationId = ${organization}`
          const store = yield* AllowanceStore
          const start = A.headNonEmpty(full.filling).at
          const at = (call: Reservation, after: number) =>
            Reservation.make({
              ...call,
              organization,
              actor,
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
      { arbitrary: { runs: 15 } }
    )
  }
)
