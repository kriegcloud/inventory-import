// Rules of the review where a wrong result hides a row or stores a wrong value: a stored SKU on a row that does not
// read yet, an item named "Total", a year written with two digits, a tags cell of separators only, a vendor cost in
// quotes, and what an edit of one item may not say.
import { describe, expect, it } from "@effect/vitest"
import { digits } from "./support/cost.ts"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as S from "effect/Schema"
import {
  discontinued,
  inactive,
  ItemEdit,
  type ItemFields,
  stockingOf,
  UnitCost
} from "@inventory/catalog-contract/Item"
import { noHistory, type Review, review } from "@inventory/catalog-model/Review"
import { stage, textFile } from "./support/files.ts"

const head =
  "sku,name,description,category,uom,unit_cost,quantity_on_hand,reorder_point,is_active,lot_tracked,tags,first_received_on,discontinued_on,dimensions,vendors"

/** One row under the schema's own headings; the values given replace the plain ones. */
const line = (values: {
  readonly sku?: string
  readonly name?: string
  readonly cost?: string
  readonly tags?: string
  readonly received?: string
  readonly vendors?: string
}): string =>
  A.join(
    [
      values.sku ?? "ABC-0001",
      values.name ?? "Steel Tube",
      "",
      "components",
      "EA",
      values.cost ?? "9.5",
      "4",
      "",
      "true",
      "false",
      values.tags ?? "",
      values.received ?? "",
      "",
      "",
      values.vendors ?? ""
    ],
    ","
  )

const reviewed = (rows: ReadonlyArray<string>, storedItems: ReadonlyArray<ItemFields> = []) =>
  Effect.map(stage(textFile(A.join([head, ...rows], "\n"))), (table) =>
    review({ ...noHistory, table, choices: [], decisions: {}, storedItems })
  )

const rowOf = (result: Review, rowNumber: number) =>
  O.getOrThrow(A.findFirst(result.rows, (row) => row.rowNumber === rowNumber))

describe("a second import", () => {
  it.effect(
    "counts a row whose SKU reads and is stored as Already there though another cell does not read, and keeps a SKU that does not read yet waiting",
    () =>
      Effect.gen(function* () {
        const first = yield* reviewed([line({ sku: "AWP-1853" }), line({ sku: "TBD-0002" })])
        const stored = A.getSomes(A.map(first.rows, (row) => row.item))
        expect(stored.length).toBe(2)
        // The same two SKUs again: one in lower case (its own proposal is open), one with a cost nobody can read.
        const again = yield* reviewed([line({ sku: "awp-1853" }), line({ sku: "TBD-0002", cost: "TBD" })], stored)
        expect([again.counts.already, again.counts.decision, again.counts.cannot]).toEqual([1, 1, 0])
        expect(O.getOrThrow(rowOf(again, 2).reason)).toContain("awp-1853")
        // The item is stored: the row adds nothing, and its unread cost is not asked for.
        expect([rowOf(again, 3).status, rowOf(again, 3).reason, rowOf(again, 3).item]).toEqual([
          "already",
          O.some("SKU TBD-0002 is already there. It is skipped, not changed."),
          O.none()
        ])
      })
  )
})

describe("a total row", () => {
  it.effect('is a row that says "Total" and has no SKU; an item named Total is an item, and counted', () =>
    Effect.gen(function* () {
      const result = yield* reviewed([line({ name: "Total" }), line({ sku: "", name: "Total" })])
      expect([result.counts.rows, result.counts.ready, result.totalRows]).toEqual([1, 1, [3]])
      expect(O.getOrThrow(rowOf(result, 2).item).name).toBe("Total")
    })
  )
})

describe("a date whose year has two digits", () => {
  it.effect("gets no proposal: the row cannot be imported until the person types the date", () =>
    Effect.gen(function* () {
      const result = yield* reviewed([line({ received: "13/04/98" })])
      const row = rowOf(result, 2)
      expect([row.outcome, row.values.firstReceivedOn, row.changes]).toEqual(["cannot", "13/04/98", []])
      expect([row.problems[0]?.proposal, row.proposals]).toEqual([O.none(), []])
      expect(O.getOrThrow(row.reason)).toBe(
        "First received “13/04/98” has a two-digit year; type it as year-month-day."
      )
    })
  )
})

describe("reasons", () => {
  it.effect('reads a tags cell of separators only as empty, and a vendor cost in quotes ("7.50") from its digits', () =>
    Effect.gen(function* () {
      const vendors = '"[{""vendor_name"":""Acme Industrial"",""unit_cost"":""7.50"",""is_preferred"":false}]"'
      const result = yield* reviewed([line({ tags: "|" }), line({ sku: "ABC-0002", vendors })])
      expect([rowOf(result, 2).status, O.getOrThrow(rowOf(result, 2).item).tags]).toEqual(["ready", []])
      expect([rowOf(result, 3).status, digits(O.getOrThrow(rowOf(result, 3).item).vendors[0]?.unitCost)]).toEqual([
        "ready",
        "7.5"
      ])
    })
  )
})

describe("a unit cost", () => {
  it.effect("is a decimal in code and its shortest digits on the wire, and refuses what is not a cost", () =>
    Effect.gen(function* () {
      const written = yield* Effect.forEach(
        ["12.50", "012.5", "0.0100", "7"],
        (text) => Effect.flatMap(S.decodeEffect(UnitCost)(text), S.encodeEffect(UnitCost)),
        { concurrency: 1 }
      )
      expect(written).toEqual(["12.5", "12.5", "0.01", "7"])
      const refused = yield* Effect.forEach(
        ["-1", "1.23456", "", "1e3", "35,82", "1234567890123"],
        (text) => Effect.isFailure(S.decodeEffect(UnitCost)(text)),
        { concurrency: 1 }
      )
      expect(refused).toEqual([true, true, true, true, true, true])
    })
  )
})

describe("an edit of one item", () => {
  // An edit as a request sends it.
  const edit = {
    revision: 1,
    name: "Steel Tube",
    description: null,
    category: "components",
    uom: "EA",
    unitCost: "9.5",
    quantityOnHand: 4,
    reorderPoint: null,
    stocking: { kind: "active" },
    lotTracked: false,
    firstReceivedOn: null
  }
  // The request field a refused edit names, or "accepted".
  const refusedOn = (sent: unknown) =>
    Effect.match(S.decodeUnknownEffect(ItemEdit)(sent), {
      onSuccess: () => "accepted",
      onFailure: (error) => Str.replace(/^[^]*at \["([^"]+)"\][^]*$/, "$1")(String(error))
    })
  it.effect("is refused by its schema, naming the field: a name of only spaces and a day off the calendar", () =>
    Effect.gen(function* () {
      const plain = yield* refusedOn(edit)
      const discontinuedOk = yield* refusedOn({ ...edit, stocking: { kind: "discontinued", on: "2024-06-19" } })
      const blankName = yield* refusedOn({ ...edit, name: "   " })
      const noSuchDay = yield* refusedOn({ ...edit, firstReceivedOn: "2024-13-45" })
      const noSuchLeapDay = yield* refusedOn({ ...edit, firstReceivedOn: "2023-02-29" })
      const badDiscontinued = yield* refusedOn({ ...edit, stocking: { kind: "discontinued", on: "2024-13-45" } })
      // Discontinued and active at once has no way to be written: the old pair of fields is not read.
      const oldPair = yield* refusedOn({ ...edit, stocking: undefined, isActive: true, discontinuedOn: "2024-06-19" })
      expect([plain, discontinuedOk, blankName, noSuchDay, noSuchLeapDay, badDiscontinued, oldPair]).toEqual([
        "accepted",
        "accepted",
        "name",
        "firstReceivedOn",
        "firstReceivedOn",
        "stocking",
        "stocking"
      ])
    })
  )
  it("the two values an item is stored with read as one: a date wins over the flag, so no item is both", () => {
    expect(stockingOf({ isActive: true, discontinuedOn: O.some("2024-06-19") })).toEqual(discontinued("2024-06-19"))
    expect([stockingOf({ isActive: true, discontinuedOn: O.none() }).kind, inactive.kind]).toEqual([
      "active",
      "inactive"
    ])
  })
})
