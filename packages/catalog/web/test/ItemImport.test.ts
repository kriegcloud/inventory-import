import { assertTrue } from "@effect/vitest/utils"
// The review of a file of inventory items: the clean sample loads as it is, each kind of mess in the messy sample
// lands in the outcome DECISIONS.md gives it, the counts add up to the rows, the form-only fixes are in force, listed
// and undoable while everything else waits for the person, and a stored item is never changed without a choice.
import { describe, expect, it } from "@effect/vitest"
import { cost, digits } from "./support/cost.ts"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import clean from "./fixtures/samples/items_clean.csv?raw"
import messy from "./fixtures/samples/items_messy.csv?raw"
import type { ItemFields } from "@inventory/catalog-contract/Item"
import { noHistory, type Review, review } from "@inventory/catalog-model/Review"
import { decisionFromFlags, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import { matchedColumn } from "@inventory/catalog-contract/Mapping"
import { type StagedTable } from "@inventory/catalog-contract/Staged"
import { stage } from "./support/files.ts"

// Decisions are written here as the flags a draft stores, and read through `decisionFromFlags`.
const reviewOf = (
  table: StagedTable,
  decisions: Readonly<Record<string, RowDecisionFlags.Encoded>>,
  storedItems: ReadonlyArray<ItemFields>
) => review({ ...noHistory, table, choices: [], decisions: R.map(decisions, decisionFromFlags), storedItems })

const rowOf = (result: Review, rowNumber: number) => {
  const expectedSome1 = A.findFirst(result.rows, (row) => row.rowNumber === rowNumber)
  assertTrue(O.isSome(expectedSome1), "expected A.findFirst(result.rows, (row) => row.rowNumber === rowNumber)")
  return expectedSome1.value
}

const numbers = (result: Review, outcome: string) =>
  A.map(
    A.filter(result.rows, (row) => row.outcome === outcome),
    (row) => row.rowNumber
  )

const cleanTable = stage(new File([clean], "items_clean.csv"))
const messyTable = stage(new File([messy], "items_messy.csv"))

describe("items_clean.csv", () => {
  it.effect("is 25 ready rows with nothing proposed, and reads the nested cells and the cost from the digits", () =>
    Effect.gen(function* () {
      const table = yield* cleanTable
      const result = reviewOf(table, {}, [])
      expect(result.counts).toMatchObject({ rows: 25, ready: 25, needs: 0, decision: 0, cannot: 0, out: 0, already: 0 })
      expect(result.fixed).toEqual({ rows: 0, cells: 0 })
      expect(A.flatMap(result.rows, (row) => row.proposals)).toEqual([])
      // Row 2 of the file: SHH-9574, 12.33 a unit, 3845 on hand, two vendors, dimensions in cm.
      const expectedSome2 = rowOf(result, 2).item
      assertTrue(O.isSome(expectedSome2), "expected rowOf(result, 2).item")
      const first = expectedSome2.value
      expect(first).toMatchObject({
        sku: "SHH-9574",
        unitCost: cost("12.33"),
        quantityOnHand: 3845,
        stocking: { kind: "active" },
        tags: ["fragile"],
        dimensions: O.some({ length: 78.8, width: 56.9, height: 2.6, unit: "cm" })
      })
      expect(first?.vendors[0]).toEqual({
        vendorName: "Tidewater Fasteners",
        vendorSku: O.some("TI-12311"),
        unitCost: cost("7.59"),
        leadTimeDays: O.some(54),
        isPreferred: false
      })
      // An empty quantity is the brief's default, 0, not a problem.
      const expectedSome3 = rowOf(result, 6).item
      assertTrue(O.isSome(expectedSome3), "expected rowOf(result, 6).item")
      expect(expectedSome3.value).toMatchObject({
        sku: "UZS-4663",
        quantityOnHand: 0,
        reorderPoint: O.none()
      })
    })
  )
})

describe("items_messy.csv", () => {
  it.effect("puts every row in one outcome, the outcomes add up to 200, and each kind is where DECISIONS.md says", () =>
    Effect.gen(function* () {
      const table = yield* messyTable
      const result = reviewOf(table, {}, [])
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
      const proposalOf = (n: number) => {
        const expectedSome4 = O.flatMap(A.head(rowOf(result, n).problems), (p) => p.proposal)
        assertTrue(O.isSome(expectedSome4), "expected O.flatMap(A.head(rowOf(result, n).problems), (p) => p.proposal)")
        return expectedSome4.value
      }
      expect(head(49)).toMatchObject({ kind: "missing", field: "sku", tone: "blocker", proposal: O.none() })
      expect(head(25)?.message).toBe('Unit cost "-2.44" is below zero. A cost is 0 or more.')
      expect(head(91)?.message).toContain("Dimensions has no height")
      // A decimal comma and a thousands comma are proposals with their evidence, never applied.
      expect(proposalOf(55)).toMatchObject({ to: "35.82", confidence: "medium", lossless: false, by: "rule" })
      expect(proposalOf(85)).toMatchObject({ to: "1200", confidence: "medium", lossless: false })
      expect(rowOf(result, 55).values.unitCost).toBe("35,82")
      // A slash date none of the column's dates settles is a question: two readings, nothing preselected.
      expect(proposalOf(44)).toMatchObject({
        to: "2024-04-06",
        alternatives: ["2024-06-04"],
        confidence: "low",
        labels: ["2024-04-06 (month first)", "2024-06-04 (day first)"]
      })
      expect(proposalOf(175)).toMatchObject({ field: "lotTracked", confidence: "low", alternatives: ["false"] })
      // The same SKU on two rows: both wait, each naming the other.
      expect([head(4)?.kind, head(4)?.rivals, head(10)?.rivals]).toEqual(["clash", ["row-10"], ["row-4"]])
      // Two preferred vendors: one reading per vendor, said in words.
      expect(proposalOf(56).labels).toEqual(["Ridgeline Metals preferred", "Acme Industrial preferred"])
      // "Internal Notes" is no field: it is reported with how many rows hold a value, and read by nothing.
      expect(result.unusedColumns).toEqual([{ index: 15, letter: "P", label: "Internal Notes", filled: 20 }])
      expect(A.every(result.mapping, (match) => O.isSome(matchedColumn(match)))).toBe(true)
    })
  )

  it.effect("applies only the form-only fixes, lists each one, and a decision of the person takes one back", () =>
    Effect.gen(function* () {
      const table = yield* messyTable
      const result = reviewOf(table, {}, [])
      expect(result.fixed).toEqual({ rows: 17, cells: 20 })
      const fixed = A.filter(result.rows, (row) => A.some(row.changes, (c) => c.how === "appliedByRule"))
      expect(A.map(fixed, (row) => row.rowNumber)).toEqual([
        8, 9, 18, 48, 60, 63, 69, 75, 111, 136, 173, 179, 182, 183, 190, 197, 198
      ])
      expect(A.every(fixed, (row) => row.status === "ready")).toBe(true)
      expect(
        A.every(
          A.flatMap(fixed, (row) => row.changes),
          (c) => c.how === "appliedByRule" && c.confidence === "high"
        )
      ).toBe(true)
      expect(rowOf(result, 18).changes).toEqual([
        {
          how: "appliedByRule",
          field: "uom",
          from: "bx",
          to: "BX",
          basis: '"bx" on 2 rows; 58 rows say BX.',
          confidence: "high"
        }
      ])
      const expectedSome5 = rowOf(result, 173).item
      assertTrue(O.isSome(expectedSome5), "expected rowOf(result, 173).item")
      expect(digits(expectedSome5.value.unitCost)).toBe("26.41")
      const expectedSome6 = rowOf(result, 198).item
      assertTrue(O.isSome(expectedSome6), "expected rowOf(result, 198).item")
      expect(expectedSome6.value.tags).toEqual(["metal"])
      // Rejected: the file's value comes back and the row waits, with the same fix offered.
      const undone = reviewOf(table, { "row-18": { reverted: ["uom"] } }, [])
      expect([rowOf(undone, 18).values.uom, rowOf(undone, 18).outcome, undone.fixed.rows]).toEqual([
        "bx",
        "decision",
        16
      ])
      const expectedSome7 = O.flatMap(A.head(rowOf(undone, 18).problems), (p) => p.proposal)
      assertTrue(O.isSome(expectedSome7), "expected O.flatMap(A.head(rowOf(undone, 18).problems), (p) => p.proposal)")
      expect(expectedSome7.value).toMatchObject({
        to: "BX",
        lossless: true
      })
    })
  )

  it.effect("turns decisions into ready rows: accepted proposals, a kept row, a typed value", () =>
    Effect.gen(function* () {
      const table = yield* messyTable
      const result = reviewOf(
        table,
        {
          "row-55": { accepted: ["unitCost"] },
          "row-85": { accepted: ["quantityOnHand"] },
          "row-44": { edits: { firstReceivedOn: "2024-06-04" } },
          "row-4": { kept: true },
          "row-10": { out: true },
          "row-45": { accepted: ["isActive"] },
          "row-184": { edits: { unitCost: "12.5000" } }
        },
        []
      )
      const expectedSome8 = rowOf(result, 55).item
      assertTrue(O.isSome(expectedSome8), "expected rowOf(result, 55).item")
      expect(digits(expectedSome8.value.unitCost)).toBe("35.82")
      const expectedSome9 = rowOf(result, 85).item
      assertTrue(O.isSome(expectedSome9), "expected rowOf(result, 85).item")
      expect(expectedSome9.value.quantityOnHand).toBe(1200)
      const expectedSome10 = rowOf(result, 44).item
      assertTrue(O.isSome(expectedSome10), "expected rowOf(result, 44).item")
      expect(expectedSome10.value.firstReceivedOn).toEqual(O.some("2024-06-04"))
      expect([rowOf(result, 4).status, rowOf(result, 10).status]).toEqual(["ready", "out"])
      const expectedSome11 = rowOf(result, 45).item
      assertTrue(O.isSome(expectedSome11), "expected rowOf(result, 45).item")
      expect(expectedSome11.value).toMatchObject({
        stocking: { kind: "discontinued", on: "2025-06-30" }
      })
      const expectedSome12 = rowOf(result, 184).item
      assertTrue(O.isSome(expectedSome12), "expected rowOf(result, 184).item")
      expect(digits(expectedSome12.value.unitCost)).toBe("12.5")
      expect(result.counts.ready + result.counts.needs + result.counts.out).toBe(200)
    })
  )
})

describe("a row discontinued yet active", () => {
  it.effect("is one question with both readings, neither applied, and each pick makes a ready item", () =>
    Effect.gen(function* () {
      const table = yield* messyTable
      for (const line of [45, 164]) {
        const asked = rowOf(reviewOf(table, {}, []), line)
        const about = A.filter(asked.problems, (problem) => problem.kind === "discontinued")
        expect(about.length, `row ${line}`).toBe(1)
        const expectedSome13 = O.flatMap(A.head(about), (p) => p.proposal)
        assertTrue(O.isSome(expectedSome13), "expected O.flatMap(A.head(about), (p) => p.proposal)")
        expect(expectedSome13.value, `row ${line}`).toMatchObject({
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
          A.filter(asked.changes, (change) => change.field === "isActive" || change.field === "discontinuedOn")
        ).toEqual([])
        expect(asked.item).toEqual(O.none())
      }
      const before = rowOf(reviewOf(table, {}, []), 45)
      expect(before.outcome).toBe("decision")
      const notActive = rowOf(reviewOf(table, { "row-45": { accepted: ["isActive"] } }, []), 45)
      const expectedSome14 = notActive.item
      assertTrue(O.isSome(expectedSome14), "expected notActive.item")
      expect([notActive.status, expectedSome14.value.stocking]).toEqual([
        "ready",
        { kind: "discontinued", on: "2025-06-30" }
      ])
      const noDate = rowOf(reviewOf(table, { "row-45": { edits: { discontinuedOn: "" } } }, []), 45)
      const expectedSome15 = noDate.item
      assertTrue(O.isSome(expectedSome15), "expected noDate.item")
      expect([noDate.status, expectedSome15.value.stocking]).toEqual(["ready", { kind: "active" }])
      expect(noDate.changes).toContainEqual(expect.objectContaining({ how: "typed", field: "discontinuedOn", to: "" }))
    })
  )
})

describe("a second import", () => {
  it.effect("adds nothing for a row that says what is stored, and asks before a stored item changes", () =>
    Effect.gen(function* () {
      const table = yield* cleanTable
      const stored = A.getSomes(A.map(reviewOf(table, {}, []).rows, (row) => row.item))
      const again = reviewOf(table, {}, stored)
      expect([again.counts.already, again.counts.ready, again.counts.needs]).toEqual([25, 0, 0])
      // The stored SHH-9574 has another name and cost than the file's row 2: the row waits, and says where.
      const other = A.map(stored, (item) =>
        item.sku === "SHH-9574" ? { ...item, name: "Oak Insert", unitCost: cost("11") } : item
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
      // What the person did to the row stands when one of its cells then stops reading: the row waits and shows
      // that cell. It is not put away as already there, with the Replace or the typed value gone from the screen.
      const broken = { edits: { quantityOnHand: "12.5" } }
      for (const decision of [{ stored: "replace" as const, ...broken }, broken]) {
        const waits = reviewOf(table, { "row-2": decision }, other)
        expect([rowOf(waits, 2).status, rowOf(waits, 2).problems[0]?.field, waits.counts.already]).toEqual([
          "needs",
          "quantityOnHand",
          24
        ])
      }
      // Replace alone, with no typed value, on a row whose cost does not read: it waits too. With no choice on it
      // the same row is already there.
      const noCostText = Str.replace(",EA,12.33,", ",EA,TBD,")(clean)
      const noCost = yield* stage(new File([noCostText], "items_clean.csv"))
      const replaceOnly = reviewOf(noCost, { "row-2": { stored: "replace" } }, other)
      expect([rowOf(replaceOnly, 2).item, rowOf(replaceOnly, 2).status, replaceOnly.counts.already]).toEqual([
        O.none(),
        "needs",
        24
      ])
      const untouched = reviewOf(noCost, {}, other)
      expect([rowOf(untouched, 2).status, untouched.counts.already]).toEqual(["already", 25])
      // A SKU in lower case reads once its proposal is accepted or the same value is typed: either way the person
      // acted on the row, and it waits on its cost. The two ways give one outcome and the same counts.
      const lower = yield* stage(new File([Str.replace("SHH-9574,", "shh-9574,")(noCostText)], "items_clean.csv"))
      const acceptedSku = reviewOf(lower, { "row-2": { accepted: ["sku"] } }, other)
      const typedSku = reviewOf(lower, { "row-2": { edits: { sku: "SHH-9574" } } }, other)
      for (const result of [acceptedSku, typedSku]) {
        expect([rowOf(result, 2).values.sku, rowOf(result, 2).status, rowOf(result, 2).problems[0]?.field]).toEqual([
          "SHH-9574",
          "needs",
          "unitCost"
        ])
      }
      expect(acceptedSku.counts).toEqual(typedSku.counts)
      expect(acceptedSku.counts.already).toBe(24)
    })
  )
})
