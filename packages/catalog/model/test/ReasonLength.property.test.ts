// A reason says a value back without carrying it: however long a cell is, the reasons of its row, joined, are what a
// store can write. Cells are drawn from the staged cell's own schema, in every band of length up to its bound.
import { describe, expect, it } from "@effect/vitest"
import { StagedCell, type StagedTable } from "@inventory/catalog-contract/Staged"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { maxSaid, said } from "@inventory/catalog-model/CellReading"
import { maxReason } from "@inventory/catalog-contract/Import"
import { ConfirmPlan, confirmPlan, fitted, maxSentence } from "@inventory/catalog-model/Confirm"
import { maxRowsNamed, review } from "@inventory/catalog-model/Review"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { marcus } from "./support.ts"

// The sample file's own headings, one for each field of an item.
const headings = [
  "SKU",
  "Item Name",
  "Description",
  "Category",
  "UoM",
  "Unit Cost ($)",
  "Qty On Hand",
  "Reorder Pt",
  "Active?",
  "Lot Tracked",
  "Tags",
  "First Received",
  "Discontinued On",
  "Dimensions (JSON)",
  "Vendors (JSON)"
] as const

const tableOf = (lines: ReadonlyArray<ReadonlyArray<string>>): StagedTable => ({
  fileName: "long.csv",
  kind: "csv",
  sheet: O.none(),
  headerRowNumber: 1,
  columns: A.map(headings, (label, index) => ({ index, letter: "A", label })),
  notes: [],
  rows: A.map(lines, (line, index) => ({ rowNumber: index + 2, cells: A.map(line, (text) => ({ text })) }))
})

const draft = ImportId.make("00000000-0000-4000-8000-000000000001")

const longest = (lines: ReadonlyArray<ReadonlyArray<string>>): number => {
  const current = review({ table: tableOf(lines), choices: [], decisions: {}, storedItems: [] })
  // The plan is made, and is one a store can be handed: no reason in it is past the bound.
  const plan = confirmPlan({ draft, review: current, authors: {}, actor: marcus })
  expect(S.is(ConfirmPlan)(plan)).toBe(true)
  return Math.max(0, ...A.map(current.rows, (row) => A.join(row.reasons, " ").length))
}

// A cell as the file may hold it, in every band of length up to the staged cell's own bound: the schema's text as it
// is drawn (short), then one just past what a sentence says back, one past a whole reason, and one at the bound.
const Text = StagedCell.fields.text
const between = (minimum: number, maximum: number) => Text.check(S.isMinLength(minimum), S.isMaxLength(maximum))
const Cell = S.Union([Text, between(81, 400), between(401, 4000), between(4001, 20000), between(32767, 32767)])
const Line = S.Tuple(A.map(headings, () => Cell))

describe("the reasons of a row, whatever its cells hold", () => {
  it.prop(
    "are never longer, joined, than a store writes",
    [S.Array(Line).check(S.isMinLength(1), S.isMaxLength(3))],
    ([lines]) => {
      expect(longest(lines)).toBeLessThanOrEqual(maxReason)
    },
    { arbitrary: { runs: 25 } }
  )

  it("stay under it with every cell of a row at its full length and wrong, and its SKU on many other rows", () => {
    const full = Str.repeat(32767)
    const vendors = `[{"vendor_name":"${Str.repeat(32000)("v")}","unit_cost":"${Str.repeat(600)("9")}x"}]`
    const dimensions = `{"length":1,"width":1,"height":1,"unit":"${Str.repeat(32000)("u")}"}`
    const line = [
      ` ${Str.repeat(32765)("s")} `,
      ` ${Str.repeat(32765)("n")} `,
      full("d"),
      full("c"),
      full("m"),
      full("$"),
      full("q"),
      full("r"),
      full("a"),
      full("l"),
      full("T"),
      full("f"),
      full("o"),
      dimensions,
      vendors
    ]
    // The same SKU on more rows than a sentence names, each with other values.
    const others = A.makeBy(maxRowsNamed + 5, (index) => A.map(line, (cell, at) => (at === 2 ? `${index}` : cell)))
    const length = longest([line, ...others])
    expect(length).toBeGreaterThan(2000)
    expect(length).toBeLessThanOrEqual(maxReason)
  })

  it("stay under it when every character of every cell takes two places in a store", () => {
    // U+1F4E6, a package: two UTF-16 units, as a store and the bound count it.
    const full = Str.repeat(16383)("\u{1F4E6}")
    const line = A.map(headings, (_heading, at) => (at === 0 ? `B${full}` : `${at}${full}`))
    const others = A.makeBy(maxRowsNamed + 5, (index) => A.map(line, (cell, at) => (at === 2 ? `${index}` : cell)))
    expect(longest([line, ...others])).toBeLessThanOrEqual(maxReason)
    // The cut counts as the bound does and never leaves half a character.
    expect(said(Str.repeat(41)("\u{1F4E6}"))).toBe(`"${Str.repeat(40)("\u{1F4E6}")}…" (82 characters)`)
    expect(said(`a${Str.repeat(41)("\u{1F4E6}")}`)).toBe(`"a${Str.repeat(39)("\u{1F4E6}")}…" (83 characters)`)
    expect(said(Str.repeat(40)("\u{1F4E6}"))).toBe(`"${Str.repeat(40)("\u{1F4E6}")}"`)
  })

  it("explain a proposal without carrying a long value either", () => {
    const tags = A.join(
      A.makeBy(5000, (index) => `T${index}`),
      "|"
    )
    const count = `1${Str.repeat(5000)(",000")}`
    const current = review({
      table: tableOf([
        ["AAA-0001", "Oak Crate", "", "packaging", "EA", "12.50", count, "", "", "", tags, "", "", "", ""]
      ]),
      choices: [],
      decisions: {},
      storedItems: []
    })
    const bases = A.flatMap(current.rows, (row) => A.map(row.proposals, (proposed) => proposed.basis))
    expect(bases.length).toBe(2)
    expect(Math.max(...A.map(bases, (basis) => basis.length))).toBeLessThan(600)
  })

  it("say a long value by its first characters and its length, and a short one whole", () => {
    expect(said("12 boxes")).toBe('"12 boxes"')
    expect(said(Str.repeat(5000)("x"))).toBe(`"${Str.repeat(maxSaid)("x")}…" (5,000 characters)`)
    const current = review({
      table: tableOf([
        [
          "AAA-0001",
          "Oak Crate",
          "",
          "packaging",
          "EA",
          "12.50",
          Str.repeat(5000)("7 "),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ]
      ]),
      choices: [],
      decisions: {},
      storedItems: []
    })
    expect(A.flatMap(current.rows, (row) => row.reasons)).toEqual([
      `Quantity on hand "${Str.takeLeft(maxSaid)(Str.repeat(5000)("7 "))}…" (9,999 characters) is not a whole number written as digits.`
    ])
  })
})

// Whatever sentences a review hands over, of any length and number: the bound is held where the plan is made.
describe("the one reason a plan holds for a row", () => {
  const Sentence = S.Union([S.String, S.String.check(S.isMinLength(1500))])

  it.prop("is never blank and never longer than a store writes", [S.Array(Sentence)], ([sentences]) => {
    const reason = fitted(sentences)
    expect(reason.length).toBeLessThanOrEqual(maxReason)
    expect(reason).toMatch(/\S/)
  })

  // At most 90 sentences of at most 40 characters: joined, they always fit.
  it.prop(
    "is every sentence, joined, when they fit",
    [S.Array(S.String.check(S.isPattern(/^\S{1,40}$/))).check(S.isMinLength(1), S.isMaxLength(90))],
    ([sentences]) => {
      expect(fitted(sentences)).toBe(A.join(sentences, " "))
    }
  )

  it("is every sentence whenever they fit, however long one of them is", () => {
    const long = Str.repeat(1500)("x")
    expect(fitted([long, long, Str.repeat(950)("y")])).toBe(`${long} ${long} ${Str.repeat(950)("y")}`)
    expect(fitted([Str.repeat(3970)("x"), "Name is empty."])).toBe(`${Str.repeat(3970)("x")} Name is empty.`)
    expect(fitted([Str.repeat(maxReason)("x")])).toBe(Str.repeat(maxReason)("x"))
  })

  it("says a long sentence by its start when they do not all fit, and keeps the short ones after it", () => {
    const long = Str.repeat(1500)("x")
    const start = `${Str.repeat(maxSaid)("x")}…`
    expect(fitted([long, long, long, long])).toBe(`${start} ${start} ${start} ${start}`)
    expect(fitted([Str.repeat(5000)("x")])).toBe(start)
    expect(fitted([Str.repeat(5000)("x"), "Name is empty."])).toBe(`${start} Name is empty.`)
    expect(fitted([Str.repeat(3990)("x"), "Name is empty."])).toBe(`${start} Name is empty.`)
    expect(fitted([`Name "${Str.repeat(5000)("x")}" is too long.`])).toBe(`Name "${Str.repeat(maxSaid - 6)("x")}…`)
  })

  it("leaves off what still does not fit and says how many, one or more", () => {
    const most = Str.repeat(maxSentence)("x")
    const six = A.join(A.replicate(most, 6), " ")
    expect(fitted(A.replicate(most, 7))).toBe(`${six} 1 more problem is not listed here.`)
    expect(fitted(A.replicate(most, 9))).toBe(`${six} 3 more problems are not listed here.`)
    // The count's own room is kept free: a sentence that fits the bound and not that room is left off with the rest.
    const crowded = fitted([...A.replicate(most, 6), Str.repeat(394)("y"), "z"])
    expect(crowded).toBe(`${six} 2 more problems are not listed here.`)
    expect(crowded.length).toBeLessThanOrEqual(maxReason)
  })

  it("holds no room back for a count when the sentences, long ones said by their start, all fit", () => {
    const most = Str.repeat(maxSentence)("x")
    const start = `${Str.repeat(maxSaid)("a")}…`
    const six = A.join(A.replicate(most, 6), " ")
    expect(fitted([Str.repeat(5000)("a"), ...A.replicate(most, 6), Str.repeat(300)("z")])).toBe(
      `${start} ${six} ${Str.repeat(300)("z")}`
    )
    expect(fitted([Str.repeat(5000)("a"), ...A.replicate(most, 6), Str.repeat(300)("z"), "q"])).toBe(
      `${start} ${six} ${Str.repeat(300)("z")} q`
    )
  })

  // The first sentence is always said: one kept whole when the rest do not fit leaves room for the count.
  it("holds a sentence kept whole far under the bound", () => {
    expect(maxSentence * 2).toBeLessThan(maxReason)
  })

  it("says something for a row with no sentence", () => {
    expect(fitted([])).toBe("A value could not be read.")
    expect(fitted(["  "])).toBe("A value could not be read.")
  })
})
