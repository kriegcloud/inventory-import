import { identity } from "effect/Function"
// What the review says must be true and must be enough to act on. Each test is a sentence that was wrong on a screen
// built from this starter: a rule's suggestion called "a guess by the model", a row with no fix that said nothing
// about why, rows nothing here can fix counted as decisions, an enabled import button that could do nothing, a table
// wider than the screen, money shown as "31.4", and the same status word kept in two places.
// @effect-diagnostics nodeBuiltinImport:off
import { readFileSync } from "node:fs"
import { describe, expect, it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import { firstDecisions, itemsOfRow, noHistory, review } from "@inventory/catalog-model/Review"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import { type StagedTable } from "@inventory/catalog-contract/Staged"
import { sourceLead, sourceWordsFor } from "@inventory/ui/ProposalSource"
import {
  act,
  confirmLine,
  count,
  decisionsLeft,
  emptyState,
  fixableBy,
  heldCsv,
  heldLine,
  kindsOf,
  Primary,
  primary,
  reasonOf,
  restored,
  viewRows,
  visible
} from "@inventory/review/ReviewDraft"
import { planColumns, type SizedColumn } from "../../../review/src/internal/sizing.ts"
import { Problem, ProblemKind, ReviewColumn, ReviewRow } from "@inventory/review/ReviewTypes"
import { defaultReviewWords, reviewWords } from "@inventory/review/ReviewWords"
import { readSpreadsheet } from "@inventory/catalog-web/Spreadsheet"
import type { ItemFields } from "@inventory/catalog-contract/Item"
import { leftToDecide } from "@inventory/catalog-web/ImportWords"
import { costText, dimensionsCellText, vendorsCellText } from "@inventory/catalog-web/ItemText"
import { vendorsDraft } from "@inventory/catalog-web/CellDrafts"
import {
  reasonShown,
  regionColumns,
  regionKinds,
  toRegionDecisions,
  toRegionRows
} from "@inventory/catalog-web/ImportReview"
import { stageTable } from "@inventory/catalog-model/Staging"

const sample = (name: string): File =>
  new File([new Uint8Array(readFileSync(new URL(`./fixtures/samples/${name}`, import.meta.url)))], name)

const stage = (file: File): Effect.Effect<StagedTable> =>
  Effect.orDie(
    Effect.map(readSpreadsheet({ onProgress: () => {}, sheet: O.none(), file }), (table) => stageTable({ table }))
  )

// As the screen opens a file: the draft a new import starts with (the rules' own fixes held back as proposals).
const sampleRows = (name: string, storedItems: ReadonlyArray<ItemFields>) =>
  Effect.map(stage(sample(name)), (table) => {
    const decisions = firstDecisions({ table, choices: [], mode: "propose", itemsOf: itemsOfRow })
    const current = review({ ...noHistory, table, choices: [], decisions, storedItems })
    return { current, decisions, rows: toRegionRows(current, decisions) }
  })

describe("who is behind a suggestion", () => {
  it("names the model only when the caller says a model made it", () => {
    expect(sourceWordsFor("model").tip).toContain("model")
    for (const source of ["rule", "person", undefined] as const) {
      const words = sourceWordsFor(source)
      expect(`${words.tag} ${words.hidden} ${words.tip}`).not.toMatch(/model/i)
    }
    expect(sourceLead({ by: "rule", confidence: "low" })).toBe("Rule, low confidence")
    expect(sourceLead({ confidence: "low" })).toBe("Suggestion, low confidence")
  })

  it.effect("calls the sample's low-confidence date reading a rule's, never a model's", () =>
    Effect.map(sampleRows("items_messy.csv", []), ({ rows }) => {
      const fixes = A.flatMap(rows, (row) => [
        ...row.applied,
        ...O.toArray(O.flatMap(row.problem, (problem) => problem.fix))
      ])
      const questions = A.filter(fixes, (fix) => O.contains(fix.confidence, "low"))
      expect(questions.length).toBeGreaterThan(0)
      for (const fix of fixes) expect(fix.by).toEqual(O.some("rule"))
      for (const fix of questions)
        expect(
          sourceLead({ ...R.getSomes({ by: fix.by }), ...R.getSomes({ confidence: fix.confidence }) })
        ).not.toMatch(/model/i)
    })
  )
})

describe("a second load after a confirm that took accepted proposals", () => {
  it.effect(
    "counts every stored item as Already there, and the views, the footer and the confirm step say the same numbers",
    () =>
      Effect.gen(function* () {
        const table = yield* stage(sample("items_messy.csv"))
        // The first import: six rows are ready only because their proposal was accepted.
        const accepted = R.map(
          {
            "row-55": { accepted: ["unitCost"] },
            "row-85": { accepted: ["quantityOnHand"] },
            "row-135": { accepted: ["category"] },
            "row-172": { accepted: ["category"] },
            "row-186": { accepted: ["quantityOnHand"] },
            "row-191": { accepted: ["unitCost"] }
          },
          decisionFromFlags
        )
        const first = review({ ...noHistory, table, choices: [], decisions: accepted, storedItems: [] })
        const stored = A.flatMap(first.rows, (each) => A.fromOption(each.item))
        expect([first.counts.ready, stored.length]).toEqual([161, 161])
        // The same file again, nothing decided: each of the six is offered its proposal no more, its item is stored.
        const current = review({ ...noHistory, table, choices: [], decisions: {}, storedItems: stored })
        expect([current.counts.already, current.counts.decision, current.counts.cannot, current.counts.ready]).toEqual([
          161, 18, 21, 0
        ])
        const statusOf = (rowNumber: number) =>
          A.map(
            A.filter(current.rows, (each) => each.rowNumber === rowNumber),
            (each) => each.status
          )
        expect(A.flatMap([55, 85, 135, 172, 186, 191], statusOf)).toEqual(A.replicate("already", 6))
        // A SKU that does not read yet as written keeps its row waiting, stored or not.
        expect(A.flatMap([148, 195], statusOf)).toEqual(["needs", "needs"])
        const counts = count(
          viewRows({
            recheck: O.none(),
            fixable: fixableBy([]),
            rejects: false,
            rows: toRegionRows(current, {}),
            state: emptyState
          })
        )
        expect([counts.stored, counts.needs, counts.cannot, counts.ready, counts.out, counts.total]).toEqual([
          161, 18, 21, 0, 0, 200
        ])
        const words = reviewWords({ stored: "Already there" })
        expect(heldLine(counts, words)).toBe(
          "200 won't be imported: Needs a decision 18, Cannot import 21, Already there 161"
        )
        expect(confirmLine({ counts, noun: ["item", "items"], words })).toBe(
          "200 items won't be imported (Needs a decision 18, Cannot import 21, Already there 161). Your file is not changed."
        )
      })
  )
})

describe("an open import's card on the Upload step", () => {
  it("names the rows that wait for a decision and the rows that cannot be imported apart, as the review counts them", () => {
    expect(leftToDecide({ decision: 24, cannot: 21, rows: 200 })).toBe(
      "24 of 200 rows need a decision, 21 cannot be imported"
    )
    expect(leftToDecide({ decision: 1, cannot: 0, rows: 25 })).toBe("1 of 25 rows needs a decision")
    expect(leftToDecide({ decision: 0, cannot: 21, rows: 200 })).toBe("21 of 200 rows cannot be imported")
    expect(leftToDecide({ decision: 0, cannot: 0, rows: 200 })).toBe("Nothing left to decide")
  })
})

describe("every row says why", () => {
  it.effect("gives each row of the sample that is not ready a sentence, the row with no fix included", () =>
    Effect.map(sampleRows("items_messy.csv", []), ({ current, decisions, rows }) => {
      const views = viewRows({
        recheck: O.none(),
        fixable: fixableBy([]),
        rejects: false,
        rows,
        state: restored(toRegionDecisions(decisions))
      })
      const kinds = kindsOf(regionKinds)
      const open = A.filter(views, (view) => view.status === "needs")
      expect(open.length).toBe(current.counts.needs)
      // A row with an empty SKU has no fix, only a refusal: it still says why, in the domain's own sentence.
      const noFix = A.filter(open, (view) => O.isNone(O.flatMap(view.problem, (problem) => problem.fix)))
      expect(noFix.length).toBeGreaterThan(0)
      for (const view of open) {
        const domain = O.getOrThrow(A.findFirst(current.rows, (row) => row.id === view.row.id))
        // The first problem's sentence, and how many more the row has behind it.
        expect(reasonOf({ words: defaultReviewWords, view, kinds })).toBe(
          reasonShown(O.getOrThrow(domain.reason), domain.reasons.length)
        )
      }
    })
  )
})

// A kind nothing on the screen can settle: the item the row names is not in the system yet.
const kinds: ReadonlyArray<ProblemKind> = [
  ProblemKind.make({ id: "unit", label: "Unit", tone: "decision" }),
  ProblemKind.make({ id: "unknown", label: "Not in system", tone: "blocker", fixable: false })
]
const columns: ReadonlyArray<ReviewColumn> = [ReviewColumn.make({ display: identity, id: "name", label: "Name" })]
const row = (line: number, extra: Partial<Parameters<typeof ReviewRow.make>[0]>): ReviewRow =>
  ReviewRow.make({
    id: `row-${line}`,
    line,
    cells: { name: `Item ${line}` },
    ...extra
  })
const unknownItem = (line: number) =>
  row(line, {
    problem: O.some(Problem.make({ kind: "unknown", reason: O.some(`Item ${line} is not in the system yet.`) }))
  })

describe("rows that cannot be fixed here", () => {
  const rows = [
    row(2, {}),
    unknownItem(3),
    unknownItem(4),
    row(5, { problem: O.some(Problem.make({ kind: "unit", column: O.some("name") })) })
  ]
  const fixable = fixableBy(kinds)
  const views = viewRows({ recheck: O.none(), rejects: false, rows, state: emptyState, fixable })

  it("are counted apart from the decisions, with their reason, and never offer an answer", () => {
    const counts = count(views)
    expect([counts.ready, counts.needs, counts.cannot, counts.out]).toEqual([1, 1, 2, 0])
    expect(counts.needs + counts.cannot + counts.ready + counts.out + counts.stored).toBe(counts.total)
    expect(decisionsLeft(views, [])).toBe(1)
    expect(A.map(visible({ kind: O.none(), views, filter: "cannot" }), (view) => view.row.line)).toEqual([3, 4])
    expect(A.map(visible({ kind: O.none(), views, filter: "needs" }), (view) => view.row.line)).toEqual([5])
    const cannot = A.findFirst(views, (view) => view.row.line === 3)
    expect(O.map(cannot, (view) => reasonOf({ words: defaultReviewWords, view, kinds: kindsOf(kinds) }))).toEqual(
      O.some("Item 3 is not in the system yet.")
    )
    expect(
      act({
        recheck: O.none(),
        rejects: false,
        rows,
        state: emptyState,
        action: { type: "leaveOut" as const, rowIds: ["row-3"] },
        fixable
      }).label
    ).toBe("")
    expect(heldLine(counts, defaultReviewWords)).toBe("3 won't be imported: Needs a decision 1, Cannot import 2")
  })

  it("do not hold the import back", () => {
    expect(
      primary({ closing: O.none(), words: defaultReviewWords, columns, counts: count(views), noun: ["item", "items"] })
    ).toEqual(Primary.Import({ label: "Import 1 item" }))
  })
})

describe("a button that could do nothing is never offered", () => {
  const noun = ["item", "items"] as const

  it("is idle while decisions are open and nothing is ready", () => {
    const counts = count(
      viewRows({
        recheck: O.none(),
        fixable: fixableBy([]),
        rejects: false,
        rows: [row(2, { problem: O.some(Problem.make({ kind: "unit", column: O.some("name") })) })],
        state: emptyState
      })
    )
    expect(primary({ closing: O.none(), words: defaultReviewWords, columns, counts, noun })).toEqual(
      Primary.Idle({ label: "No items ready yet" })
    )
  })

  it("gives way to words when only rows nothing here can fix are left", () => {
    const counts = count(
      viewRows({
        recheck: O.none(),
        rejects: false,
        rows: [unknownItem(2)],
        state: emptyState,
        fixable: fixableBy(kinds)
      })
    )
    expect(primary({ closing: O.none(), words: defaultReviewWords, columns, counts, noun })).toEqual(
      Primary.Done({ label: defaultReviewWords.nothingToImport })
    )
  })

  it.effect("ends a second load of the same file on 'Nothing new' once every row is already there", () =>
    Effect.gen(function* () {
      // Every item of the clean sample is stored, as after a first import of every row.
      const first = yield* sampleRows("items_clean.csv", [])
      const items = A.flatMap(first.current.rows, (each) => A.fromOption(each.item))
      expect(items.length).toBe(25)
      const { rows } = yield* sampleRows("items_clean.csv", items)
      const counts = count(
        viewRows({ recheck: O.none(), fixable: fixableBy([]), rejects: false, rows, state: emptyState })
      )
      expect(counts.stored).toBe(25)
      expect(primary({ closing: O.none(), words: defaultReviewWords, columns, counts, noun })).toEqual(
        Primary.Done({ label: "Nothing new: this file is already in" })
      )
    })
  )
})

describe("status words", () => {
  it("are set once by the caller and said everywhere they show", () => {
    const words = reviewWords({ out: "Skipped", stored: "In stock already", needs: "Waiting on you" })
    const rows = [
      row(2, { problem: O.some(Problem.make({ kind: "unit", column: O.some("name") })) }),
      row(3, {}),
      row(4, { stored: true })
    ]
    const left = act({
      recheck: O.none(),
      fixable: fixableBy([]),
      rejects: false,
      rows,
      state: emptyState,
      action: { type: "leaveOut" as const, rowIds: ["row-3"] }
    }).state
    const views = viewRows({ recheck: O.none(), fixable: fixableBy([]), rejects: false, rows, state: left })
    const csv = heldCsv({ views, columns, problemKinds: kinds, words })
    expect(csv).toContain("3,Skipped,Item 3")
    expect(csv).toContain("4,In stock already,Item 4")
    expect(csv).not.toContain(defaultReviewWords.out)
    expect(heldLine(count(views), words)).toBe("3 won't be imported: Waiting on you 1, Skipped 1, In stock already 1")
  })

  it("keep the current words as defaults, each said once", () => {
    const values = R.values(defaultReviewWords)
    expect(A.dedupe(values)).toHaveLength(values.length)
    expect(reviewWords({})).toEqual(defaultReviewWords)
  })
})

describe("the table fits at 1440", () => {
  // At 1440 by 900 with the sidebar open the review's table has about 1,130 px, less the work list on Needs you.
  const room = 1134
  const fit = (id: string, need: number, priority: number): SizedColumn => ({
    id,
    size: "fit",
    need,
    priority,
    keep: false
  })
  const fill = (id: string, need: number, priority: number): SizedColumn => ({
    id,
    size: "fill",
    need,
    priority,
    keep: false
  })

  it("moves columns into the row's detail, a second description included, before it scrolls sideways", () => {
    const columns = [
      { ...fill("name", 200, 0), keep: true },
      { ...fill("reason", 180, 0), keep: true },
      fill("description", 200, 1),
      fill("supplier", 200, 1),
      fit("part", 150, 2),
      fit("pack", 140, 1),
      fit("price", 110, 2),
      fit("lead", 90, 0),
      fit("date", 110, 0),
      fill("note", 200, 0)
    ]
    const plan = planColumns({ columns, fixed: 360 + 120, room })
    expect(plan.scrolls).toBe(false)
    expect(plan.minWidth).toBeLessThanOrEqual(room)
    expect(A.map(plan.shown, (column) => column.id)).toContain("reason")
  })
})

describe("a cost, the dimensions and the vendors in the review", () => {
  it("read as the Items page shows them, and a value that does not read stays as the file has it", () => {
    expect(costText("31.4")).toBe("$31.40")
    expect(costText("1095")).toBe("$1,095.00")
    expect(costText("0.0125")).toBe("$0.0125")
    expect(costText("12.34567")).toBe("12.34567")
    expect(costText("TBD")).toBe("TBD")
    expect(costText("")).toBe("")
    expect(dimensionsCellText('{"length":78.8,"width":56.9,"height":2.6,"unit":"cm"}')).toBe("78.8 × 56.9 × 2.6 cm")
    expect(dimensionsCellText('{"length":78.8,"width":56.9}')).toBe('{"length":78.8,"width":56.9}')
    expect(
      vendorsCellText(
        '[{"vendor_name":"Acme Industrial","unit_cost":3.35},{"vendor_name":"Summit Polymers","is_preferred":true}]'
      )
    ).toBe("2 · Summit Polymers preferred")
    expect(vendorsCellText('[{"vendor_name":"Acme')).toBe('[{"vendor_name":"Acme')
    // A cell cut off after a vendor's name says so, with the name, instead of showing the file's JSON.
    expect(vendorsCellText('[{"vendor_name":"Keystone Components","vendor_sku":"KE-61504')).toBe(
      "Cut off · Keystone Components"
    )
  })

  it("opens the vendors form with what a cut-off cell holds, whole vendors and the one cut short", () => {
    // Rows 80 and 157 of the messy sample.
    expect(vendorsDraft('[{"vendor_name":"Keystone Components","vendor_sku":"KE-61504')).toEqual([
      { name: "Keystone Components", sku: "KE-61504", cost: "", lead: "", preferred: false }
    ])
    expect(
      vendorsDraft(
        '[{"vendor_name":"Acme Industrial","unit_cost":3.5,"is_preferred":true},{"vendor_name":"Copperline Supply","vendor_sku":"CO-33160","unit_cost":14.19,"is_preferred":false'
      )
    ).toEqual([
      { name: "Acme Industrial", sku: "", cost: "3.5", lead: "", preferred: true },
      { name: "Copperline Supply", sku: "CO-33160", cost: "14.19", lead: "", preferred: false }
    ])
  })

  it.effect("is how the sample's cost column shows, with no second currency sign in its header", () =>
    Effect.map(
      Effect.map(stage(sample("items_messy.csv")), (table) => ({
        table,
        current: review({ ...noHistory, table, choices: [], decisions: {}, storedItems: [] })
      })),
      ({ table, current }) => {
        const found = A.findFirst(
          regionColumns(current.mapping, current.unusedColumns, table),
          (column) => column.id === "unitCost"
        )
        assertTrue(O.isSome(found), "expected the unit cost column")
        const cost = found.value
        expect(cost.unit).toEqual(O.none())
        expect(cost.display("31.4")).toBe("$31.40")
      }
    )
  )
})
