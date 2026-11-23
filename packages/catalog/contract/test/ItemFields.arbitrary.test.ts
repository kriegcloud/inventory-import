// An item's values are generated for every test that needs an item, a plan or a stored row, so each schema of an
// item draws only values it accepts: a generator that throws most draws away runs out before a property sees a cost,
// a discontinued item or a received date. Each schema here draws 100 values with no discard at all, and what it draws
// is what an item may hold, read off the value itself.
import { describe, expect, it } from "@effect/vitest"
import { calendarDayPattern, discontinuedOn, ItemFields, UnitCost, Vendor } from "@inventory/catalog-contract/Item"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as BigDecimal from "effect/BigDecimal"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const twoDigits = Str.padStart(2, "0")
// Twelve whole digits at most: a cost is below 10^12 dollars.
const trillion = BigDecimal.fromBigInt(1_000_000_000_000n)

/** A hundred values of a schema, drawn with no discard: a discard fails the draw. */
const draw = <T>(schema: S.Codec<T, unknown>) =>
  Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 100, maxDiscards: 0 })

/**
 * Whether a year-month-day text names a day the clock's calendar has, from year 1000 to 9999: read back through
 * `DateTime`, not through the item's own reading of a day, so the two can be told apart.
 */
const onTheCalendar = (day: string): boolean => {
  const [year, month, date] = A.map(Str.split("-")(day), Number)
  if (year === undefined || month === undefined || date === undefined) return false
  const landed = DateTime.toPartsUtc(DateTime.makeUnsafe({ year, month, day: date }))
  const written = `${year}-${twoDigits(`${month}`)}-${twoDigits(`${date}`)}`
  return written === day && year >= 1000 && year <= 9999 && landed.month === month && landed.day === date
}

// A year, a month and a day of the month up to 31: about one in twenty is no day (the 31st of a 30-day month, the 29th
// of February outside a leap year), which is the case the pattern must refuse.
const DayParts = S.Struct({
  year: S.Int.check(S.isBetween({ minimum: 1000, maximum: 9999 })),
  month: S.Int.check(S.isBetween({ minimum: 1, maximum: 12 })),
  day: S.Int.check(S.isBetween({ minimum: 1, maximum: 31 }))
})

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
        // Read off the decimal itself, not through the cost's own pattern.
        expect(BigDecimal.isNegative(cost)).toBe(false)
        expect(BigDecimal.normalize(cost).scale).toBeLessThanOrEqual(4)
        expect(BigDecimal.isLessThan(cost, trillion)).toBe(true)
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
