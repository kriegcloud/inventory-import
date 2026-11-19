// The review of a file of inventory items: the clean sample loads as it is, each kind of mess in the messy sample
// lands in the outcome DECISIONS.md gives it, the counts add up to the rows, the form-only fixes are in force, listed
// and undoable while everything else waits for the person, and a stored item is never changed without a choice.
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Record as Rec } from "effect"
import clean from "../../public/samples/items_clean.csv?raw"
import messy from "../../public/samples/items_messy.csv?raw"
import type { ItemFields } from "../../src/domain/Item.ts"
import {
  decisionFromFlags,
  matchedColumn,
  type Review,
  review,
  type RowDecisionFlags,
  type StagedTable
} from "../../src/domain/ItemImport.ts"
import { stage } from "../server/support/files.ts"

// Decisions are written here as the flags a draft stores, and read through `decisionFromFlags`.
const reviewOf = (
  table: StagedTable,
  decisions: Readonly<Record<string, RowDecisionFlags>> = {},
  storedItems: ReadonlyArray<ItemFields> = []
) => review({ table, choices: [], decisions: Rec.map(decisions, decisionFromFlags), storedItems })

const rowOf = (result: Review, rowNumber: number) =>
  Option.getOrThrow(Arr.findFirst(result.rows, (row) => row.rowNumber === rowNumber))

const numbers = (result: Review, outcome: string) =>
  Arr.map(
    Arr.filter(result.rows, (row) => row.outcome === outcome),
    (row) => row.rowNumber
  )

const cleanTable = stage(new File([clean], "items_clean.csv"))
const messyTable = stage(new File([messy], "items_messy.csv"))

describe("items_clean.csv", () => {
  it.effect("is 25 ready rows with nothing proposed, and reads the nested cells and the cost from the digits", () =>
    Effect.gen(function* () {
      const table = yield* cleanTable
      const result = reviewOf(table)
      expect(result.counts).toMatchObject({ rows: 25, ready: 25, needs: 0, decision: 0, cannot: 0, out: 0, already: 0 })
      expect(result.fixed).toEqual({ rows: 0, cells: 0 })
      expect(Arr.flatMap(result.rows, (row) => row.proposals)).toEqual([])
      // Row 2 of the file: SHH-9574, 12.33 a unit, 3845 on hand, two vendors, dimensions in cm.
      const first = rowOf(result, 2).item
      expect(first).toMatchObject({
        sku: "SHH-9574",
        unitCost: "12.33",
        quantityOnHand: 3845,
        stocking: { kind: "active" },
        tags: ["fragile"],
        dimensions: Option.some({ length: 78.8, width: 56.9, height: 2.6, unit: "cm" })
      })
      expect(first?.vendors[0]).toEqual({
        vendorName: "Tidewater Fasteners",
        vendorSku: Option.some("TI-12311"),
        unitCost: "7.59",
        leadTimeDays: Option.some(54),
        isPreferred: false
      })
      // An empty quantity is the brief's default, 0, not a problem.
      expect(rowOf(result, 6).item).toMatchObject({ sku: "UZS-4663", quantityOnHand: 0, reorderPoint: Option.none() })
    })
  )
})

describe("items_messy.csv", () => {
  it.effect("puts every row in one outcome, the outcomes add up to 200, and each kind is where DECISIONS.md says", () =>
    Effect.gen(function* () {
      const table = yield* messyTable
      const result = reviewOf(table)
      const { counts } = result
      expect(counts.rows).toBe(200)
      expect(counts.ready + counts.decision + counts.cannot + counts.out + counts.already).toBe(200)
      expect([counts.ready, counts.decision, counts.cannot]).toEqual([155, 24, 21])
      // Cannot import: a value only the person can type. Empty SKU or "ab-12", empty name, "Misc", a cost that is
      // "TBD" or below zero, a quantity of 12.5, dimensions without a height, a vendors cell cut off, month 13.
      expect(numbers(result, "cannot")).toEqual([
        7, 19, 25, 40, 49, 80, 83, 91, 92, 103, 106, 116, 125, 142, 145, 152, 157, 159, 184, 193, 196
      ])
      // Needs a decision: a proposal to accept or reject, a question with two readings, or two rows with one SKU.
      expect(numbers(result, "decision")).toEqual([
        4, 10, 15, 43, 44, 45, 52, 55, 56, 85, 89, 102, 108, 130, 135, 148, 151, 164, 171, 172, 175, 186, 191, 195
      ])
      const head = (n: number) => rowOf(result, n).problems[0]
      expect(head(49)).toMatchObject({ kind: "missing", field: "sku", tone: "blocker", proposal: null })
      expect(head(25)?.message).toBe('Unit cost "-2.44" is below zero. A cost is 0 or more.')
      expect(head(91)?.message).toContain("Dimensions has no height")
      // A decimal comma and a thousands comma are proposals with their evidence, never applied.
      expect(head(55)?.proposal).toMatchObject({ to: "35.82", confidence: "medium", lossless: false, by: "rule" })
      expect(head(85)?.proposal).toMatchObject({ to: "1200", confidence: "medium", lossless: false })
      expect(rowOf(result, 55).values.unitCost).toBe("35,82")
      // A slash date none of the column's dates settles is a question: two readings, nothing preselected.
      expect(head(44)?.proposal).toMatchObject({
        to: "2024-04-06",
        alternatives: ["2024-06-04"],
        confidence: "low",
        labels: ["2024-04-06 (month first)", "2024-06-04 (day first)"]
      })
      expect(head(175)?.proposal).toMatchObject({ field: "lotTracked", confidence: "low", alternatives: ["false"] })
      // The same SKU on two rows: both wait, each naming the other.
      expect([head(4)?.kind, head(4)?.rivals, head(10)?.rivals]).toEqual(["clash", ["row-10"], ["row-4"]])
      // Two preferred vendors: one reading per vendor, said in words.
      expect(head(56)?.proposal?.labels).toEqual(["Ridgeline Metals preferred", "Acme Industrial preferred"])
      // "Internal Notes" is no field: it is reported with how many rows hold a value, and read by nothing.
      expect(result.unusedColumns).toEqual([{ index: 15, letter: "P", label: "Internal Notes", filled: 20 }])
      expect(Arr.every(result.mapping, (match) => Option.isSome(matchedColumn(match)))).toBe(true)
    })
  )

  it.effect("applies only the form-only fixes, lists each one, and a decision of the person takes one back", () =>
    Effect.gen(function* () {
      const table = yield* messyTable
      const result = reviewOf(table)
      expect(result.fixed).toEqual({ rows: 17, cells: 20 })
      const fixed = Arr.filter(result.rows, (row) => Arr.some(row.changes, (c) => c.how === "applied by a rule"))
      expect(Arr.map(fixed, (row) => row.rowNumber)).toEqual([
        8, 9, 18, 48, 60, 63, 69, 75, 111, 136, 173, 179, 182, 183, 190, 197, 198
      ])
      expect(Arr.every(fixed, (row) => row.status === "ready")).toBe(true)
      expect(
        Arr.every(
          Arr.flatMap(fixed, (row) => row.changes),
          (c) => c.confidence === "high"
        )
      ).toBe(true)
      expect(rowOf(result, 18).changes).toEqual([
        {
          field: "uom",
          from: "bx",
          to: "BX",
          source: "rule",
          decidedBy: "rule",
          how: "applied by a rule",
          basis: '"bx" on 2 rows; 58 rows say BX.',
          confidence: "high"
        }
      ])
      expect(rowOf(result, 173).item?.unitCost).toBe("26.41")
      expect(rowOf(result, 198).item?.tags).toEqual(["metal"])
      // Rejected: the file's value comes back and the row waits, with the same fix offered.
      const undone = reviewOf(table, { "row-18": { reverted: ["uom"] } })
      expect([rowOf(undone, 18).values.uom, rowOf(undone, 18).outcome, undone.fixed.rows]).toEqual([
        "bx",
        "decision",
        16
      ])
      expect(rowOf(undone, 18).problems[0]?.proposal).toMatchObject({ to: "BX", lossless: true })
    })
  )

  it.effect("turns decisions into ready rows: accepted proposals, a kept row, a typed value", () =>
    Effect.gen(function* () {
      const table = yield* messyTable
      const result = reviewOf(table, {
        "row-55": { accepted: ["unitCost"] },
        "row-85": { accepted: ["quantityOnHand"] },
        "row-44": { edits: { firstReceivedOn: "2024-06-04" } },
        "row-4": { kept: true },
        "row-10": { out: true },
        "row-45": { accepted: ["isActive"] },
        "row-184": { edits: { unitCost: "12.5000" } }
      })
      expect(rowOf(result, 55).item?.unitCost).toBe("35.82")
      expect(rowOf(result, 85).item?.quantityOnHand).toBe(1200)
      expect(rowOf(result, 44).item?.firstReceivedOn).toEqual(Option.some("2024-06-04"))
      expect([rowOf(result, 4).status, rowOf(result, 10).status]).toEqual(["ready", "out"])
      expect(rowOf(result, 45).item).toMatchObject({ stocking: { kind: "discontinued", on: "2025-06-30" } })
      expect(rowOf(result, 184).item?.unitCost).toBe("12.5")
      expect(result.counts.ready + result.counts.needs + result.counts.out).toBe(200)
    })
  )
})

describe("a row discontinued yet active", () => {
  it.effect("is one question with both readings, neither applied, and each pick makes a ready item", () =>
    Effect.gen(function* () {
      const table = yield* messyTable
      for (const line of [45, 164]) {
        const asked = rowOf(reviewOf(table), line)
        const about = Arr.filter(asked.problems, (problem) => problem.kind === "discontinued")
        expect(about.length, `row ${line}`).toBe(1)
        expect(about[0]?.proposal, `row ${line}`).toMatchObject({
          field: "isActive",
          confidence: "low",
          lossless: false,
          to: "false",
          alternatives: [""],
          labels: ["Not active", "No discontinued date"],
          targets: ["isActive", "discontinuedOn"]
        })
        // Nothing is taken for the person: the file's values stand and the row waits.
        expect([asked.values.isActive, asked.values.discontinuedOn]).toEqual([
          asked.file.isActive,
          asked.file.discontinuedOn
        ])
        expect(
          Arr.filter(asked.changes, (change) => change.field === "isActive" || change.field === "discontinuedOn")
        ).toEqual([])
        expect(asked.item).toBeNull()
      }
      const before = rowOf(reviewOf(table), 45)
      expect(before.outcome).toBe("decision")
      const notActive = rowOf(reviewOf(table, { "row-45": { accepted: ["isActive"] } }), 45)
      expect([notActive.status, notActive.item?.stocking]).toEqual([
        "ready",
        { kind: "discontinued", on: "2025-06-30" }
      ])
      const noDate = rowOf(reviewOf(table, { "row-45": { edits: { discontinuedOn: "" } } }), 45)
      expect([noDate.status, noDate.item?.stocking]).toEqual(["ready", { kind: "active" }])
      expect(noDate.changes).toContainEqual(
        expect.objectContaining({ field: "discontinuedOn", to: "", decidedBy: "person" })
      )
    })
  )
})

describe("a second import", () => {
  it.effect("adds nothing for a row that says what is stored, and asks before a stored item changes", () =>
    Effect.gen(function* () {
      const table = yield* cleanTable
      const stored = Arr.getSomes(Arr.map(reviewOf(table).rows, (row) => Option.fromNullishOr(row.item)))
      const again = reviewOf(table, {}, stored)
      expect([again.counts.already, again.counts.ready, again.counts.needs]).toEqual([25, 0, 0])
      // The stored SHH-9574 has another name and cost than the file's row 2: the row waits, and says where.
      const other = Arr.map(stored, (item) =>
        item.sku === "SHH-9574" ? { ...item, name: "Oak Insert", unitCost: "11" } : item
      )
      const asked = reviewOf(table, {}, other)
      expect([asked.counts.already, asked.counts.decision]).toEqual([24, 1])
      expect(rowOf(asked, 2).problems[0]).toMatchObject({ kind: "changed", tone: "decision" })
      expect(rowOf(asked, 2).stored).toEqual([
        { field: "name", stored: "Oak Insert", file: "Oak Foam Insert" },
        { field: "unitCost", stored: "11", file: "12.33" }
      ])
      const kept = reviewOf(table, { "row-2": { stored: "keep" } }, other)
      expect([rowOf(kept, 2).status, rowOf(kept, 2).update, kept.counts.already]).toEqual(["already", false, 25])
      const replaced = reviewOf(table, { "row-2": { stored: "replace" } }, other)
      expect([rowOf(replaced, 2).status, rowOf(replaced, 2).update, replaced.counts.updates]).toEqual([
        "ready",
        true,
        1
      ])
    })
  )
})
