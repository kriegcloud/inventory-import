// Every exported schema generates only values it accepts (schema-first rule SF-7).
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { NoRows } from "@beep/d1/D1"
import { D1Stage } from "@beep/d1/D1Error"
import { D1TestOptions } from "@beep/d1/D1Test"

const runs = { arbitrary: { runs: 50 } }
const schemas = { NoRows, D1Stage, D1TestOptions }

describe("every schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema as S.Top)],
      ([value]) => {
        expect(S.is(schema as S.Top)(value)).toBe(true)
      },
      runs
    )
  }
})
