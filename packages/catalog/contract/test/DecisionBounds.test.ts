// What a save and a confirm may say of the revisions their decisions were made on (`madeOn`) is bounded as the rows it
// speaks of are. A name longer than a row id (40 characters) is not read: it names no row, and a row that names no
// revision counts as made on revision 0. More than 50,000 rows is refused as the request it is.
import { describe, expect, it } from "@effect/vitest"
import { ConfirmRequest, SaveRequest } from "@inventory/catalog-contract/Decision"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const save = S.decodeUnknownOption(SaveRequest)
const confirm = S.decodeUnknownOption(ConfirmRequest)

/** What a save, and a confirm, that says this of its rows is read as saying; none where it is refused. */
const read = (madeOn: Readonly<Record<string, number>>) => [
  O.map(save({ madeOn, set: {}, clear: [] }), (request) => request.madeOn),
  O.map(confirm({ revision: 1, madeOn, set: {}, clear: [] }), (request) => request.madeOn)
]
const both = <A>(one: A) => [one, one]

/** The revisions of this many rows. */
const rows = (count: number) => R.fromEntries(A.makeBy(count, (n) => [`row-${n}`, 1] as const))

describe("the revisions a save's or a confirm's decisions were made on", () => {
  it("are read for row ids of at most 40 characters, and for nothing longer", () => {
    const longest = { [Str.repeat(40)("r")]: 1 }
    expect(read(longest)).toEqual(both(O.some(longest)))
    expect(read({ ...longest, [Str.repeat(41)("r")]: 1 })).toEqual(both(O.some(longest)))
  })

  it("are of at most 50,000 rows: one more is refused", () => {
    expect(A.map(read(rows(50_000)), O.isSome)).toEqual(both(true))
    expect(A.map(read(rows(50_001)), O.isSome)).toEqual(both(false))
  })

  it("are revisions, never negative and always whole: anything else is refused", () => {
    expect(A.map(read({ "row-1": 0 }), O.isSome)).toEqual(both(true))
    expect(A.map(read({ "row-1": -1 }), O.isSome)).toEqual(both(false))
    expect(A.map(read({ "row-1": 1.5 }), O.isSome)).toEqual(both(false))
  })
})
