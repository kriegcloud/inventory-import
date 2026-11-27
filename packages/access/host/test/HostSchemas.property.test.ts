// The host's own schemas generate only values they accept (docs/standards/schema-first.md, SF-7).
import { describe, expect, it } from "@effect/vitest"
import { StagePassword } from "@inventory/access-host/Config"
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

describe("every host schema generates only valid values", () => {
  generatesOnlyValid("StagePassword", StagePassword)
})
