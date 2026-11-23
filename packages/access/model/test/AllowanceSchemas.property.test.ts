// The allowance's schemas generate only values they accept (docs/standards/schema-first.md, SF-7): a drawn call is one
// the store could be asked to take.
import { describe, expect, it } from "@effect/vitest"
import { CallMoment, Reservation } from "@inventory/access-model/AllowanceStore"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 50 } }

/** `schema` generates only values it accepts. */
const generatesOnlyValid = <Schema extends S.Top>(name: string, schema: Schema) =>
  it.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) => {
      expect(S.is(schema)(value)).toBe(true)
    },
    runs
  )

describe("every allowance schema generates only valid values", () => {
  generatesOnlyValid("CallMoment", CallMoment)
  generatesOnlyValid("Reservation", Reservation)
})
