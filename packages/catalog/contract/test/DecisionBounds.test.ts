// What a save and a confirm may say of the revisions their decisions were made on (`madeOn`) is bounded as the rows it
// speaks of are. A key that is no row id names no row and is not read; a row that names no revision counts as made on
// revision 0. More than 50,000 rows is refused as the request it is. Data is generated from the schemas, except the
// 50,000 row ids of the bound, which the contract's own `rowId` spells.
import { describe, expect, it } from "@effect/vitest"
import { ConfirmRequest, rowId, SaveRequest } from "@inventory/catalog-contract/Decision"
import { RowId, rowIdPattern } from "@inventory/catalog-contract/Ids"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 100 } }

const save = S.decodeUnknownOption(SaveRequest)
const confirm = S.decodeUnknownOption(ConfirmRequest)

/** What a save, and a confirm, that says this of its rows is read as saying; none where it is refused. */
const read = (madeOn: Readonly<Record<string, number>>) => [
  O.map(save({ madeOn, set: {}, clear: [] }), (request) => request.madeOn),
  O.map(confirm({ revision: 1, madeOn, set: {}, clear: [] }), (request) => request.madeOn)
]
const both = <A>(one: A) => [one, one]

const Revisions = S.Record(RowId, S.Natural).check(S.isMaxProperties(20))
const NoRowId = S.String.check(
  S.makeFilter((text: string) => !rowIdPattern.test(text), { expected: "a text that is no row id" })
)
const NoRevision = S.Finite.check(
  S.makeFilter((n: number) => !Number.isInteger(n) || n < 0, { expected: "a number no revision is" })
)

/** The revisions of this many rows, numbered from 1. */
const rows = (count: number) =>
  R.fromEntries(A.makeBy(count, (n) => [rowId({ rowNumber: n + 1, part: O.none() }), 1] as const))

describe("the revisions a save's or a confirm's decisions were made on", () => {
  it.prop(
    "are read for row ids, and a key that is no row id is not read",
    [Arbitrary.schema(Revisions), Arbitrary.schema(NoRowId), Arbitrary.schema(S.Natural)],
    ([madeOn, junk, revision]) => {
      expect(read(madeOn)).toEqual(both(O.some(madeOn)))
      expect(read({ ...madeOn, [junk]: revision })).toEqual(both(O.some(madeOn)))
    },
    runs
  )

  it("are of at most 50,000 rows: one more is refused", () => {
    expect(A.map(read(rows(50_000)), O.isSome)).toEqual(both(true))
    expect(A.map(read(rows(50_001)), O.isSome)).toEqual(both(false))
  })

  it.prop(
    "are revisions, never negative and always whole: anything else is refused",
    [Arbitrary.schema(Revisions), Arbitrary.schema(RowId), Arbitrary.schema(NoRevision)],
    ([madeOn, row, wrong]) => {
      expect(A.map(read({ ...madeOn, [row]: wrong }), O.isSome)).toEqual(both(false))
    },
    runs
  )
})
