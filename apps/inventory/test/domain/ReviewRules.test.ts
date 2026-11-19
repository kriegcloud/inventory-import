// Rules of the review where a wrong result hides a row or stores a wrong value: a stored SKU on a row that does not
// read yet, an item named "Total", a year written with two digits, a tags cell of separators only, a vendor cost in
// quotes, and what an edit of one item may not say.
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, String as Str } from "effect"
import * as S from "effect/Schema"
import { discontinued, inactive, ItemEdit, type ItemFields, stockingOf } from "../../src/domain/Item.ts"
import { type Review, review } from "../../src/domain/ItemImport.ts"
import { stage, textFile } from "../server/support/files.ts"

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
  Arr.join(
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
  Effect.map(stage(textFile(Arr.join([head, ...rows], "\n"))), (table) =>
    review({ table, choices: [], decisions: {}, storedItems })
  )

const rowOf = (result: Review, rowNumber: number) =>
  Option.getOrThrow(Arr.findFirst(result.rows, (row) => row.rowNumber === rowNumber))

describe("a second import", () => {
  it.effect("keeps a row whose SKU is stored but which does not read yet out of Already there, with its reason", () =>
    Effect.gen(function* () {
      const first = yield* reviewed([line({ sku: "AWP-1853" }), line({ sku: "TBD-0002" })])
      const stored = Arr.getSomes(Arr.map(first.rows, (row) => Option.fromNullishOr(row.item)))
      expect(stored.length).toBe(2)
      // The same two SKUs again: one in lower case (a proposal is open), one with a cost nobody can read.
      const again = yield* reviewed([line({ sku: "awp-1853" }), line({ sku: "TBD-0002", cost: "TBD" })], stored)
      expect([again.counts.already, again.counts.decision, again.counts.cannot]).toEqual([0, 1, 1])
      expect(rowOf(again, 2).reason).toContain("awp-1853")
      expect(rowOf(again, 3).reason).toBe('Unit cost "TBD" is not an amount in dollars written as digits.')
    })
  )
})

describe("a total row", () => {
  it.effect('is a row that says "Total" and has no SKU; an item named Total is an item, and counted', () =>
    Effect.gen(function* () {
      const result = yield* reviewed([line({ name: "Total" }), line({ sku: "", name: "Total" })])
      expect([result.counts.rows, result.counts.ready, result.totalRows]).toEqual([1, 1, [3]])
      expect(rowOf(result, 2).item?.name).toBe("Total")
    })
  )
})

describe("a date whose year has two digits", () => {
  it.effect("gets no proposal: the row cannot be imported until the person types the date", () =>
    Effect.gen(function* () {
      const result = yield* reviewed([line({ received: "13/04/98" })])
      const row = rowOf(result, 2)
      expect([row.outcome, row.values.firstReceivedOn, row.changes]).toEqual(["cannot", "13/04/98", []])
      expect([row.problems[0]?.proposal, row.proposals]).toEqual([null, []])
      expect(row.reason).toBe("First received “13/04/98” has a two-digit year; type it as year-month-day.")
    })
  )
})

describe("reasons", () => {
  it.effect('reads a tags cell of separators only as empty, and a vendor cost in quotes ("7.50") from its digits', () =>
    Effect.gen(function* () {
      const vendors = '"[{""vendor_name"":""Acme Industrial"",""unit_cost"":""7.50"",""is_preferred"":false}]"'
      const result = yield* reviewed([line({ tags: "|" }), line({ sku: "ABC-0002", vendors })])
      expect([rowOf(result, 2).status, rowOf(result, 2).item?.tags]).toEqual(["ready", []])
      expect([rowOf(result, 3).status, rowOf(result, 3).item?.vendors[0]?.unitCost]).toEqual(["ready", "7.5"])
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
    expect(stockingOf({ isActive: true, discontinuedOn: Option.some("2024-06-19") })).toEqual(
      discontinued("2024-06-19")
    )
    expect([stockingOf({ isActive: true, discontinuedOn: Option.none() }).kind, inactive.kind]).toEqual([
      "active",
      "inactive"
    ])
  })
})
