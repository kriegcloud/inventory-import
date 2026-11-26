import { cycle } from "./cycle.ts"
import { ReviewText } from "../../src/internal/ReviewText.rules.ts"
import { identity } from "effect/Function"
/**
 * Made-up stock for a small fabrication shop, for the review gallery and its tests. Development only: nothing in
 * the app imports this. The shape of the mess is fixed per block of 178 rows: 136 ready (17 of them with a
 * spelling fix already applied) and 42 that need the person, across five kinds.
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as MutableHashMap from "effect/MutableHashMap"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as R from "effect/Record"
import { Activity, Fix, Problem, ProblemKind, ReviewColumn, ReviewRow } from "@inventory/review/ReviewTypes"

export const problemKinds: ReadonlyArray<ProblemKind> = [
  ProblemKind.make({
    id: "unit",
    label: "Unknown unit",
    tone: "decision",
    help: O.some("The unit is not on your unit list."),
    fixable: true
  }),
  ProblemKind.make({
    id: "cost",
    label: "No cost",
    tone: "blocker",
    help: O.some("Each needs a cost before it can be imported."),
    fixable: true
  }),
  ProblemKind.make({
    id: "copy",
    label: "Same SKU",
    tone: "decision",
    help: O.some("Two different rows share a SKU. Give one a new SKU, or leave one out."),
    fixable: true
  }),
  ProblemKind.make({
    id: "below",
    label: "Below zero",
    tone: "blocker",
    help: O.some("Stock cannot be below zero. Type the count."),
    fixable: true
  }),
  ProblemKind.make({
    id: "name",
    label: "No name",
    tone: "blocker",
    help: O.some("No name in the file. The SKU is offered as the name."),
    fixable: true
  })
]

const units = ["pcs", "kg", "m", "L"] as const

const matched = (source: string, samples: ReadonlyArray<string>, by: "name" | "model") =>
  ({ state: "matched", source, by, samples }) as const

export const columns: ReadonlyArray<ReviewColumn> = [
  ReviewColumn.make({
    display: identity,
    id: "name",
    label: "Item",
    size: "fill",
    width: O.some(200),
    core: true,
    match: O.some(matched("Item name", ["Flat bar 40 × 5", "Hex bolt M8 × 30", "Weld wire 0.9 mm"], "name"))
  }),
  ReviewColumn.make({
    display: identity,
    id: "sku",
    code: true,
    search: true,
    context: true,
    label: "SKU",
    core: true,
    under: true,
    match: O.some(matched("SKU", ["FB-40-5", "HB-M8-30", "WW-09"], "name"))
  }),
  ReviewColumn.make({
    display: identity,
    id: "category",
    facet: true,
    label: "Category",
    match: O.some(matched("Group", ["Bar", "Fasteners", "Welding"], "model"))
  }),
  ReviewColumn.make({
    display: identity,
    id: "unit",
    label: "Unit",
    core: true,
    priority: O.some(2),
    match: O.some(matched("UOM", ["m", "PCS", "kg"], "name"))
  }),
  ReviewColumn.make({
    display: identity,
    id: "onHand",
    context: true,
    label: "On hand",
    align: O.some("right"),
    core: true,
    match: O.some(matched("Qty on hand", ["120", "1,200", "45"], "name"))
  }),
  ReviewColumn.make({
    display: identity,
    id: "reorder",
    hidden: true,
    label: "Reorder at",
    align: O.some("right"),
    match: O.some(matched("Reorder point", ["20", "200", "10"], "name"))
  }),
  ReviewColumn.make({
    display: identity,
    id: "cost",
    label: "Cost",
    align: O.some("right"),
    match: O.some(matched("Unit cost", ["$4.85", "$0.18", "$3.40"], "name"))
  }),
  ReviewColumn.make({
    display: identity,
    id: "supplier",
    facet: true,
    context: true,
    label: "Supplier",
    match: O.some(matched("Vendor", ["Harlow Steel", "Tri-County Fasteners", "Weldcraft Supply"], "model"))
  }),
  ReviewColumn.make({
    display: identity,
    id: "bin",
    code: true,
    hidden: true,
    label: "Bin",
    match: O.some(matched("Bin", ["A-04", "C-11", "D-02"], "name"))
  }),
  ReviewColumn.make({
    display: identity,
    id: "lead",
    hidden: true,
    label: "Lead time",
    unit: O.some("days"),
    align: O.some("right"),
    match: O.some(matched("Lead time (days)", ["5", "3", "7"], "name"))
  })
]

/** The same columns with Unit tied between two file columns, so the import is blocked until the person picks. */
export const columnsUnmatched: ReadonlyArray<ReviewColumn> = columns.map((column) =>
  column.id === "unit"
    ? {
        ...column,
        match: O.some({
          state: "unmatched" as const,
          candidates: [
            { source: "UOM", samples: ["m", "PCS", "kg"] },
            { source: "Pack", samples: ["bundle", "box 100", "spool"] }
          ]
        })
      }
    : column
)

type Family = {
  readonly name: string
  readonly code: string
  readonly category: string
  readonly unit: (typeof units)[number]
  readonly supplier: string
  readonly sizes: A.NonEmptyReadonlyArray<readonly [label: string, code: string]>
  readonly cost: number
}

const pairs = (list: A.NonEmptyReadonlyArray<string>): A.NonEmptyReadonlyArray<readonly [string, string]> =>
  A.map(
    list,
    (label) => [label, label.replace(/ mm$/, "").replace(/ × /g, "-").replace(/ /g, "-").replace(/\./g, "")] as const
  )

const families: A.NonEmptyReadonlyArray<Family> = [
  {
    name: "Flat bar",
    code: "FB",
    category: "Bar",
    unit: "m",
    supplier: "Harlow Steel",
    cost: 4.85,
    sizes: pairs([
      "20 × 3",
      "25 × 3",
      "25 × 5",
      "30 × 5",
      "40 × 5",
      "40 × 6",
      "50 × 5",
      "50 × 6",
      "50 × 10",
      "60 × 6",
      "75 × 6",
      "75 × 10",
      "100 × 6",
      "100 × 10",
      "120 × 10"
    ])
  },
  {
    name: "Hex bolt",
    code: "HB",
    category: "Fasteners",
    unit: "pcs",
    supplier: "Tri-County Fasteners",
    cost: 0.18,
    sizes: pairs([
      "M6 × 16",
      "M6 × 20",
      "M6 × 30",
      "M8 × 20",
      "M8 × 30",
      "M8 × 40",
      "M10 × 25",
      "M10 × 40",
      "M10 × 60",
      "M12 × 30",
      "M12 × 50",
      "M12 × 80",
      "M16 × 40",
      "M16 × 60",
      "M20 × 80"
    ])
  },
  {
    name: "Square tube",
    code: "ST",
    category: "Tube",
    unit: "m",
    supplier: "Harlow Steel",
    cost: 7.2,
    sizes: pairs([
      "20 × 2",
      "25 × 2",
      "30 × 2",
      "40 × 2",
      "40 × 3",
      "50 × 3",
      "60 × 3",
      "75 × 3",
      "80 × 4",
      "100 × 4",
      "100 × 5",
      "120 × 5",
      "150 × 5",
      "150 × 6",
      "200 × 6"
    ])
  },
  {
    name: "Weld wire",
    code: "WW",
    category: "Welding",
    unit: "kg",
    supplier: "Weldcraft Supply",
    cost: 3.4,
    sizes: pairs([
      "ER70S 0.8 mm",
      "ER70S 0.9 mm",
      "ER70S 1.0 mm",
      "ER70S 1.2 mm",
      "ER308L 0.8 mm",
      "ER308L 1.0 mm",
      "ER316L 0.9 mm",
      "ER4043 1.0 mm",
      "ER5356 1.2 mm",
      "E71T 1.2 mm",
      "E71T 1.6 mm",
      "ER70S 1.6 mm",
      "ER309L 1.0 mm",
      "ER4043 1.2 mm",
      "ER5356 1.0 mm"
    ])
  },
  {
    name: "Flat washer",
    code: "FW",
    category: "Fasteners",
    unit: "pcs",
    supplier: "Tri-County Fasteners",
    cost: 0.04,
    sizes: pairs(["M5", "M6", "M8", "M10", "M12", "M14", "M16", "M18", "M20", "M22", "M24", "M27", "M30", "M33", "M36"])
  },
  {
    name: "Angle",
    code: "AN",
    category: "Bar",
    unit: "m",
    supplier: "Harlow Steel",
    cost: 5.6,
    sizes: pairs([
      "25 × 3",
      "30 × 3",
      "40 × 4",
      "50 × 5",
      "60 × 6",
      "65 × 6",
      "75 × 6",
      "75 × 8",
      "90 × 8",
      "100 × 8",
      "100 × 10",
      "125 × 10",
      "150 × 10",
      "150 × 12",
      "200 × 16"
    ])
  },
  {
    name: "Cutting disc",
    code: "CD",
    category: "Abrasives",
    unit: "pcs",
    supplier: "Abrasive Depot",
    cost: 1.15,
    sizes: pairs([
      "115 × 1.0",
      "115 × 1.6",
      "125 × 1.0",
      "125 × 1.6",
      "125 × 2.5",
      "150 × 1.6",
      "180 × 2.0",
      "180 × 3.0",
      "230 × 2.0",
      "230 × 3.0",
      "300 × 3.5",
      "350 × 3.5",
      "355 × 2.8",
      "400 × 4.0",
      "76 × 1.0"
    ])
  },
  {
    name: "Electrode",
    code: "EL",
    category: "Welding",
    unit: "kg",
    supplier: "Weldcraft Supply",
    cost: 5.9,
    sizes: pairs([
      "E6013 2.5 mm",
      "E6013 3.2 mm",
      "E6013 4.0 mm",
      "E7018 2.5 mm",
      "E7018 3.2 mm",
      "E7018 4.0 mm",
      "E7016 3.2 mm",
      "E308L 2.5 mm",
      "E308L 3.2 mm",
      "E309L 3.2 mm",
      "E316L 2.5 mm",
      "E6010 3.2 mm",
      "E6011 3.2 mm",
      "E7024 4.0 mm",
      "E312 3.2 mm"
    ])
  },
  {
    name: "Hex nut",
    code: "HN",
    category: "Fasteners",
    unit: "pcs",
    supplier: "Tri-County Fasteners",
    cost: 0.06,
    sizes: pairs(["M5", "M6", "M8", "M10", "M12", "M14", "M16", "M18", "M20", "M22", "M24", "M27", "M30", "M33", "M36"])
  },
  {
    name: "Round bar",
    code: "RB",
    category: "Bar",
    unit: "m",
    supplier: "Harlow Steel",
    cost: 6.3,
    sizes: pairs([
      "8 mm",
      "10 mm",
      "12 mm",
      "16 mm",
      "20 mm",
      "25 mm",
      "30 mm",
      "36 mm",
      "40 mm",
      "45 mm",
      "50 mm",
      "60 mm",
      "70 mm",
      "80 mm",
      "100 mm"
    ])
  },
  {
    name: "Primer grey",
    code: "PG",
    category: "Paint",
    unit: "L",
    supplier: "Kessler Coatings",
    cost: 9.75,
    sizes: pairs([
      "1 L tin",
      "2.5 L tin",
      "5 L tin",
      "10 L pail",
      "20 L pail",
      "zinc 1 L",
      "zinc 5 L",
      "etch 1 L",
      "etch 5 L",
      "epoxy 4 L",
      "epoxy 20 L",
      "red oxide 5 L",
      "red oxide 20 L",
      "high build 5 L",
      "high build 20 L"
    ])
  },
  {
    name: "Flap disc",
    code: "FD",
    category: "Abrasives",
    unit: "pcs",
    supplier: "Abrasive Depot",
    cost: 2.4,
    sizes: pairs([
      "115 P40",
      "115 P60",
      "115 P80",
      "115 P120",
      "125 P40",
      "125 P60",
      "125 P80",
      "125 P120",
      "180 P40",
      "180 P60",
      "180 P80",
      "125 zirconia P40",
      "125 zirconia P80",
      "125 ceramic P40",
      "125 ceramic P60"
    ])
  }
]

const block = 178
/** Rank 0..177 for each position, spread through the file so the rows that need the person are not in one clump. */
const rankOf = (position: number): number => (position * 7) % block

/** What a row of the block is: clean, or the one kind of mess it carries. */
const Role = LiteralKit(["each", "length", "cost", "copyA", "copyB", "below", "name", "kg", "pcs", "clean"])
type Role = typeof Role.Type

const roleOf = (rank: number): Role => {
  if (rank < 9) return "each"
  if (rank < 12) return "length"
  if (rank < 21) return "cost"
  if (rank < 29) return rank % 2 === 1 ? "copyA" : "copyB"
  if (rank < 36) return "below"
  if (rank < 42) return "name"
  if (rank < 50) return "kg"
  if (rank < 59) return "pcs"
  return "clean"
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const whole = new Intl.NumberFormat("en-US")

const eachFix = (from: string): Fix =>
  Fix.make({
    column: "unit",
    to: "pcs",
    by: O.some("rule"),
    confidence: O.some("high"),
    kind: "unit",
    group: O.some("unit:each"),
    why: { basis: `"${from}" means each: one piece.`, detail: O.some("Matched against your unit list: pcs, kg, m, L.") }
  })

const lengthFix: Fix = Fix.make({
  column: "unit",
  to: "pcs",
  by: O.some("model"),
  confidence: O.some("low"),
  kind: "unit",
  group: O.some("unit:length"),
  why: {
    basis: "A stock length is usually one piece.",
    detail: O.some("Choose m if you count this stock in metres. Only the unit changes; quantities stay as they are."),
    alternatives: ["m"]
  }
})

const caseFix = (to: "kg" | "pcs"): Fix =>
  Fix.make({
    column: "unit",
    to,
    by: O.some("rule"),
    confidence: O.some("high"),
    kind: "unit",
    group: O.some(`unit:case:${to}`),
    why: { basis: `The same unit as ${to}, spelled another way.` }
  })

type StockCells = Record<
  "name" | "sku" | "category" | "unit" | "onHand" | "reorder" | "cost" | "supplier" | "bin" | "lead",
  string
>

/** The file as the review reads it: `size` rows, the same mix in every block of 178. `clean` removes every problem. */
export function makeRows(input: {
  readonly size: number
  readonly clean?: boolean
  readonly withoutUnit?: boolean
}): ReadonlyArray<ReviewRow> {
  const rows: Array<ReviewRow & { readonly cells: StockCells }> = []
  const cycling = A.map(families, (family) => {
    const turn = MutableRef.make(0)
    return { ...family, next: () => MutableRef.getAndIncrement(turn) }
  })
  for (let position = 0; position < input.size; position += 1) {
    const rank = rankOf(position % block)
    const lot = Math.floor(position / block)
    const role: Role = input.clean === true ? "clean" : roleOf(rank)
    // The role picks the kind of item so the mess is believable: bolts counted "each", bar bought in "lengths".
    const pool =
      role === "each" || role === "pcs"
        ? cycling.filter((family) => family.unit === "pcs")
        : role === "length"
          ? cycling.filter((family) => family.unit === "m")
          : role === "kg"
            ? cycling.filter((family) => family.unit === "kg")
            : cycling
    const family = A.match(pool, {
      onEmpty: () => A.headNonEmpty(cycling),
      onNonEmpty: (pool) => cycle(pool, position)
    })
    const turn = family.next()
    const size = A.reduce(family.sizes, A.headNonEmpty(family.sizes), (chosen, size, index) =>
      index === turn % family.sizes.length ? size : chosen
    )
    const series = Math.floor(turn / family.sizes.length)
    const suffix =
      series === 0 ? "" : ` / ${String.fromCharCode(65 + (series % 26))}${series > 25 ? Math.floor(series / 26) : ""}`
    const id = `r${position + 1}`
    const line = position + 2
    const onHand = ((position * 37) % 23) * (family.unit === "pcs" ? 50 : 5) + (family.unit === "pcs" ? 100 : 10)
    const cells: StockCells = {
      name: `${family.name} ${size[0]}${suffix}`,
      sku: `${family.code}-${size[1]}${suffix === "" ? "" : `-${suffix.slice(3)}`}`,
      category: family.category,
      unit: family.unit,
      onHand: whole.format(onHand),
      reorder: whole.format(Math.max(5, Math.round(onHand / 5))),
      cost: money.format(family.cost + (turn % 7) * 0.35),
      supplier: family.supplier,
      bin: `${"ABCDEF"[position % 6]}-${String((position % 14) + 1).padStart(2, "0")}`,
      lead: String(3 + (position % 5) * 2)
    }
    let problem: O.Option<Problem> = O.none()
    let applied: ReadonlyArray<Fix> = []
    // Ranks pair up (21 with 22, 23 with 24, ...): the later row repeats the earlier row's SKU.
    const copy = (): void => {
      const otherRank = role === "copyA" ? rank + 1 : rank - 1
      const otherPosition = lot * block + ((otherRank * 51) % block)
      if (otherPosition >= input.size) return
      problem = Problem.makeOption({
        kind: "copy",
        column: O.some("sku"),
        ask: O.some("Type a new SKU"),
        rivals: O.some([`r${otherPosition + 1}`])
      })
    }
    Role.match(role, {
      each: () => {
        cells.unit = rank < 6 ? "ea" : "each"
        problem = Problem.makeOption({ kind: "unit", column: O.some("unit"), fix: O.some(eachFix(cells.unit)) })
      },
      length: () => {
        cells.unit = "length"
        problem = Problem.makeOption({ kind: "unit", column: O.some("unit"), fix: O.some(lengthFix) })
      },
      cost: () => {
        cells.cost = ""
        problem = Problem.makeOption({ kind: "cost", column: O.some("cost"), ask: O.some("Type a cost") })
      },
      copyA: copy,
      copyB: copy,
      below: () => {
        cells.onHand = `-${(position % 9) + 3}`
        problem = Problem.makeOption({ kind: "below", column: O.some("onHand"), ask: O.some("Type the count") })
      },
      name: () => {
        cells.name = ""
        problem = Problem.makeOption({
          kind: "name",
          column: O.some("name"),
          fix: O.some(
            Fix.make({
              column: "name",
              to: cells.sku,
              by: O.some("rule"),
              confidence: O.some("medium"),
              kind: "name",
              why: {
                basis: "The file has no name for this row.",
                detail: O.some("Its SKU is the only label it has, so the SKU is offered as the name.")
              }
            })
          )
        })
      },
      kg: () => {
        cells.unit = rank < 47 ? "KG" : "Kgs"
        applied = [caseFix("kg")]
      },
      pcs: () => {
        cells.unit = rank < 56 ? "PCS" : "Pcs."
        applied = [caseFix("pcs")]
      },
      clean: () => undefined
    })
    if (input.withoutUnit === true) {
      cells.unit = ""
      applied = []
      problem = O.filter(problem, (value) => value.kind !== "unit")
    }
    rows.push({ ...ReviewRow.make({ id, line, cells, applied, problem }), cells })
  }
  // The guess for "length" is made from the file, not from a sentence: which unit the other rows of the same
  // categories use decides what is suggested, and the count is the basis shown to the person.
  const guessed = rows.filter((row) =>
    O.exists(
      O.flatMap(row.problem, (problem) => problem.fix),
      (fix) => O.contains(fix.group, "unit:length")
    )
  )
  if (guessed.length > 0) {
    const categories = A.dedupe(guessed.map((row) => row.cells.category))
    const tally = { m: 0, pcs: 0 }
    for (const row of rows) {
      O.match(row.problem, {
        onNone: () => {
          const unit = row.cells.unit
          if (row.applied.length > 0) return
          if (!categories.includes(row.cells.category) || (unit !== "m" && unit !== "pcs")) return
          tally[unit] += 1
        },
        onSome: () => undefined
      })
    }
    const m = tally.m
    const pcs = tally.pcs
    const [to, other] = m >= pcs ? (["m", "pcs"] as const) : (["pcs", "m"] as const)
    const fix: Fix = Fix.make({
      ...lengthFix,
      to,
      why: {
        basis: `${Math.max(m, pcs)} other ${categories.join(" and ")} rows in this file use ${to}; ${Math.min(m, pcs)} use ${other}.`,
        detail: O.some("Only the unit changes; quantities stay as they are."),
        alternatives: [other]
      }
    })
    for (const [index, row] of rows.entries()) {
      if (
        O.exists(
          O.flatMap(row.problem, (problem) => problem.fix),
          (fix) => O.contains(fix.group, "unit:length")
        )
      )
        rows[index] = { ...row, problem: O.map(row.problem, (problem) => ({ ...problem, fix: O.some(fix) })) }
    }
  }
  // The later row of each pair repeats the earlier row's SKU: that is what makes them copies.
  const byId = MutableHashMap.fromIterable(rows.map((row) => [row.id, row] as const))
  return rows.map((row) => {
    const rival = O.flatMap(
      O.flatMap(row.problem, (problem) => problem.rivals),
      A.head
    )
    const other = O.flatMap(rival, (id) => MutableHashMap.get(byId, id))
    return O.match(other, {
      onNone: () => row,
      onSome: (other) => (other.line > row.line ? row : { ...row, cells: { ...row.cells, sku: other.cells.sku } })
    })
  })
}

/** The gallery's pure check of one row after the person typed a value. Copies need the whole file, so not here. */
export function recheck(input: {
  readonly row: ReviewRow
  readonly cells: Readonly<Record<string, string>>
}): O.Option<Problem> {
  const { cells } = input
  if (O.match(R.get(cells, "name"), { onNone: () => true, onSome: (name) => ReviewText.comparison(name) === "" }))
    return Problem.makeOption({ kind: "name", column: O.some("name") })
  if (!O.exists(R.get(cells, "unit"), (unit) => A.some(units, (known) => known === unit)))
    return Problem.makeOption({ kind: "unit", column: O.some("unit") })
  if (!O.exists(R.get(cells, "cost"), (cost) => /^\$?\d[\d,]*(\.\d+)?$/.test(ReviewText.comparison(cost))))
    return Problem.makeOption({ kind: "cost", column: O.some("cost") })
  if (O.exists(R.get(cells, "onHand"), (onHand) => ReviewText.comparison(onHand).startsWith("-")))
    return Problem.makeOption({ kind: "below", column: O.some("onHand") })
  return O.none()
}

export const activity = (rows: number): Activity =>
  Activity.make({
    steps: [
      {
        id: "read",
        by: "read",
        label: `Read ${whole.format(rows)} rows and 10 columns`,
        detail: O.some("items.csv, first sheet, header on line 1")
      },
      {
        id: "match",
        by: "rule",
        label: "Matched 8 columns by name",
        detail: O.some("Exact after trimming case and spaces")
      },
      {
        id: "match-model",
        by: "model",
        label: "Matched 2 columns by meaning",
        detail: O.some("Group → Category, Vendor → Supplier")
      },
      { id: "fix", by: "rule", label: "Applied 17 spelling fixes", detail: O.some("KG, Kgs → kg · PCS, Pcs. → pcs") },
      {
        id: "flag",
        by: "rule",
        label: "Flagged 42 rows",
        detail: O.some("Unit, cost, SKU, stock level and name checks")
      },
      {
        id: "propose",
        by: "model",
        label: "Guessed a unit for 3 rows",
        detail: O.some("length → pcs or m, low confidence: left for you to choose")
      }
    ],
    allowed: ["Read the uploaded file", "Read your unit list and stored SKUs", "Propose a value from your lists"],
    facts: [
      { label: "Model calls", value: "2 of 4" },
      { label: "Cost", value: "$0.004" },
      { label: "File", value: "items.csv, 14 kB" },
      { label: "Uploaded by", value: "Jess, 09:14" }
    ]
  })
