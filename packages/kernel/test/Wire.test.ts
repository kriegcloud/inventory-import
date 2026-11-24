// A key left out while it holds its empty value: code always has it, and what is stored or sent looks as it did
// before the key was always there. A stored draft written by an older build must read, and one written now must
// look the same, or every draft in the database would change shape on its next save.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { emptyWhenLeftOut } from "@inventory/kernel/Wire"

const Flags = S.Struct({
  accepted: emptyWhenLeftOut(S.Array(S.String), { empty: [], isEmpty: A.isReadonlyArrayEmpty }),
  edits: emptyWhenLeftOut(S.Record(S.String, S.String), { empty: {}, isEmpty: R.isEmptyRecord }),
  out: emptyWhenLeftOut(S.Boolean, { empty: false, isEmpty: (out) => !out })
})

describe("a key left out while empty", () => {
  it.effect("reads a record that leaves every key out as empty", () =>
    Effect.gen(function* () {
      const flags = yield* S.decodeEffect(Flags)({})
      expect(flags).toEqual({ accepted: [], edits: {}, out: false })
    })
  )

  it.effect("writes the empty values as nothing, and the others as they are", () =>
    Effect.gen(function* () {
      const empty = yield* S.encodeEffect(Flags)({ accepted: [], edits: {}, out: false })
      expect(empty).toEqual({})
      const full = yield* S.encodeEffect(Flags)({ accepted: ["uom"], edits: { name: "Bolt" }, out: true })
      expect(full).toEqual({ accepted: ["uom"], edits: { name: "Bolt" }, out: true })
    })
  )

  it("starts empty when made", () => {
    expect(Flags.make({})).toEqual({ accepted: [], edits: {}, out: false })
  })
})
