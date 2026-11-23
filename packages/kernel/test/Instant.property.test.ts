// A moment the server recorded travels as ISO text, and the text is what a store compares (`createdAt < before`) and
// what a list is sorted by. So the text of any two moments the schema accepts sorts exactly as the moments do, and a
// moment whose ISO text would not (a year past 9999 is written `+010000-…`, a year before 0 `-000001-…`) is refused.
import { describe, expect, it } from "@effect/vitest"
import { Instant } from "@inventory/kernel/Text"
import * as Arbitrary from "effect/Arbitrary"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 500 } }
const written = S.encodeEffect(Instant)

/** Text compared code unit by code unit, as SQLite's BINARY collation and a plain sort do. */
const textOrder = (a: string, b: string): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0)

// The moments just past each end of the four-digit years, generated: what a clock gone wrong or a typed year could be.
const isAfter = S.makeIsGreaterThan({ order: DateTime.Order })
const isBefore = S.makeIsLessThan({ order: DateTime.Order })
const AfterYear9999 = S.DateTimeUtc.check(isAfter(DateTime.makeUnsafe("9999-12-31T23:59:59.999Z")))
const BeforeYear0 = S.DateTimeUtc.check(isBefore(DateTime.makeUnsafe("0000-01-01T00:00:00.000Z")))

describe("a moment the server recorded", () => {
  it.effect.prop(
    "two moments compare as text the way they compare in time",
    [Arbitrary.schema(Instant), Arbitrary.schema(Instant)],
    ([a, b]) =>
      Effect.gen(function* () {
        const [textA, textB] = [yield* written(a), yield* written(b)]
        const inTime = DateTime.isLessThan(a, b) ? -1 : DateTime.isGreaterThan(a, b) ? 1 : 0
        expect(textOrder(textA, textB)).toBe(inTime)
      }),
    runs
  )

  it.prop(
    "past year 9999 or before year 0 is refused",
    [Arbitrary.schema(AfterYear9999), Arbitrary.schema(BeforeYear0)],
    ([late, early]) => {
      expect(S.is(Instant)(late)).toBe(false)
      expect(S.is(Instant)(early)).toBe(false)
    },
    runs
  )

  it.effect.prop(
    "reads back as the moment it was written as",
    [Arbitrary.schema(Instant)],
    ([moment]) =>
      Effect.gen(function* () {
        const text = yield* written(moment)
        const read = yield* S.decodeEffect(Instant)(text)
        expect(DateTime.toEpochMillis(read)).toBe(DateTime.toEpochMillis(moment))
      }),
    runs
  )
})
