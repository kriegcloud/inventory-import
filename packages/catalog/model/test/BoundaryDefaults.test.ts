import { expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { StoredDecisions } from "../src/Import/ImportStore.port.ts"
import { Row } from "../src/Reading/Spreadsheet.rules.ts"
import { withPreferred } from "../src/Review/CellReading.rules.ts"

it.effect("a row starts visible without extra cells and leaves both empty keys out when encoded", () =>
  Effect.gen(function* () {
    const wire = { rowNumber: 2, cells: [] }
    const row = yield* S.decodeEffect(Row)(wire)
    expect(row).toEqual({ ...wire, extra: [], hidden: false })
    expect(Row.make(wire)).toEqual(row)
    const encoded = yield* S.encodeEffect(Row)(row)
    expect(encoded).toEqual(wire)
    expect(structuredClone(row)).toEqual(row)
    const full = { ...row, hidden: true, extra: [{ letter: "D", cell: { type: "text" as const, text: "kept" } }] }
    const written = yield* S.encodeEffect(Row)(full)
    const read = yield* S.decodeEffect(Row)(written)
    expect(read).toEqual(full)
  })
)

it("changing the preferred vendor preserves both missing keys and explicit nulls", () => {
  const written =
    '[{"vendor_name":"A","unit_cost":1},{"vendor_name":"B","unit_cost":2,"vendor_sku":null,"lead_time_days":null}]'
  expect(withPreferred({ text: written, keep: 1 })).toEqual(
    O.some(
      '[{"vendor_name":"A","unit_cost":1,"is_preferred":false},{"vendor_name":"B","vendor_sku":null,"unit_cost":2,"lead_time_days":null,"is_preferred":true}]'
    )
  )
})

it.prop("StoredDecisions generates only valid values", [Arbitrary.schema(StoredDecisions)], ([value]) => {
  expect(S.is(StoredDecisions)(value)).toBe(true)
})
