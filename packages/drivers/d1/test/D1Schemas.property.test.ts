// Every exported schema generates only values it accepts (schema-first rule SF-7).
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import { NoRows } from "@beep/d1/D1"
import { D1Stage } from "@beep/d1/D1Error"
import { D1Instant } from "@beep/d1/D1Instant"
import { D1TestOptions } from "@beep/d1/D1Test"

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

describe("every schema generates only valid values", () => {
  generatesOnlyValid("NoRows", NoRows)
  generatesOnlyValid("D1Stage", D1Stage)
  generatesOnlyValid("D1TestOptions", D1TestOptions)
  generatesOnlyValid("D1Instant", D1Instant)
})
