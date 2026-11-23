// An item's values are generated for every test that needs an item, a plan or a stored row, so each schema of an
// item draws only values it accepts: a generator that throws most draws away runs out before a property sees a cost,
// a discontinued item or a received date. Each schema here draws 100 values with no discard at all, and what it draws
// is what an item may hold, read off the value itself.
import { describe, expect, it } from "@effect/vitest"
import {
  calendarDayPattern,
  decimalPattern,
  discontinuedOn,
  isoDate,
  ItemFields,
  UnitCost,
  Vendor
} from "@inventory/catalog-contract/Item"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as BigDecimal from "effect/BigDecimal"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"

/** A hundred values of a schema, drawn with no discard: a discard fails the draw. */
const draw = <T>(schema: S.Codec<T, unknown>) =>
  Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 100, maxDiscards: 0 })

/** The day a year-month-day text names, read back through the calendar: the same text only for a day on it. */
const onTheCalendar = (day: string): boolean => {
  const [year, month, date] = A.map(Str.split("-")(day), Number)
  return O.contains(isoDate({ year: year ?? 0, month: month ?? 0, day: date ?? 0 }), day)
}

// A year, a month and a day of the month up to 31: about one in twenty is no day (the 31st of a 30-day month, the 29th
// of February outside a leap year), which is the case the pattern must refuse.
const DayParts = S.Struct({
  year: S.Int.check(S.isBetween({ minimum: 1000, maximum: 9999 })),
  month: S.Int.check(S.isBetween({ minimum: 1, maximum: 12 })),
  day: S.Int.check(S.isBetween({ minimum: 1, maximum: 31 }))
})
const twoDigits = Str.padStart(2, "0")

const schemas: Readonly<Record<string, S.Codec<unknown, unknown>>> = {
  UnitCost,
  Vendor,
  ItemFields,
  ...ItemFields.fields
}

describe("an item's values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.effect(`${name} draws 100 values without a discard`, () =>
      Effect.gen(function* () {
        const drawn = yield* draw(schema)
        expect(drawn.length).toBe(100)
      })
    )
  }

  it.prop(
    "the calendar's pattern accepts a day exactly when the clock's calendar has it",
    [Arbitrary.schema(DayParts)],
    ([parts]) => {
      const text = `${parts.year}-${twoDigits(`${parts.month}`)}-${twoDigits(`${parts.day}`)}`
      // The clock's calendar rolls the 31st of April over into May: the day it lands on is the day only on the calendar.
      const landsOn = DateTime.getPartUtc(DateTime.makeUnsafe(parts), "day")
      expect(calendarDayPattern.test(text)).toBe(landsOn === parts.day)
    },
    { arbitrary: { runs: 2000 } }
  )

  it.effect("a drawn cost is never negative, with at most four decimals and twelve whole digits", () =>
    Effect.gen(function* () {
      const costs = yield* draw(UnitCost)
      for (const cost of costs) {
        expect(BigDecimal.isNegative(cost)).toBe(false)
        expect(decimalPattern.test(BigDecimal.format(cost))).toBe(true)
      }
    })
  )

  it.effect("a drawn item's dates are days on the calendar", () =>
    Effect.gen(function* () {
      const items = yield* draw(ItemFields)
      for (const item of items) {
        const days = [...O.toArray(item.firstReceivedOn), ...O.toArray(discontinuedOn(item.stocking))]
        expect(A.every(days, onTheCalendar)).toBe(true)
      }
    })
  )
})
