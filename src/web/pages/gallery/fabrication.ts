/**
 * Made-up stock for a small fabrication shop, for the review gallery and its tests. Development only: nothing in
 * the app imports this. The shape of the mess is fixed per block of 178 rows: 136 ready (17 of them with a
 * spelling fix already applied) and 42 that need the person, across five kinds.
 */
import { Array as Arr, MutableHashMap, Option } from "effect"
import type { Activity, Fix, Problem, ProblemKind, ReviewColumn, ReviewRow } from "../../components/review/types.ts"

export const problemKinds: ReadonlyArray<ProblemKind> = [
  { id: "unit", label: "Unknown unit", tone: "decision", help: "The unit is not on your unit list." },
  { id: "cost", label: "No cost", tone: "blocker", help: "Each needs a cost before it can be imported." },
  {
    id: "copy",
    label: "Same SKU",
    tone: "decision",
    help: "Two different rows share a SKU. Give one a new SKU, or leave one out."
  },
  { id: "below", label: "Below zero", tone: "blocker", help: "Stock cannot be below zero. Type the count." },
  { id: "name", label: "No name", tone: "blocker", help: "No name in the file. The SKU is offered as the name." }
]

const units = ["pcs", "kg", "m", "L"] as const

const matched = (source: string, samples: ReadonlyArray<string>, by: "name" | "model" = "name") =>
  ({ state: "matched", source, by, samples }) as const

export const columns: ReadonlyArray<ReviewColumn> = [
  {
    id: "name",
    label: "Item",
    size: "fill",
    width: 200,
    core: true,
    match: matched("Item name", ["Flat bar 40 × 5", "Hex bolt M8 × 30", "Weld wire 0.9 mm"])
  },
  {
    id: "sku",
    code: true,
    search: true,
    context: true,
    label: "SKU",
    core: true,
    under: true,
    match: matched("SKU", ["FB-40-5", "HB-M8-30", "WW-09"])
  },
  {
    id: "category",
    facet: true,
    label: "Category",
    match: matched("Group", ["Bar", "Fasteners", "Welding"], "model")
  },
  { id: "unit", label: "Unit", core: true, priority: 2, match: matched("UOM", ["m", "PCS", "kg"]) },
  {
    id: "onHand",
    context: true,
    label: "On hand",
    align: "right",
    core: true,
    match: matched("Qty on hand", ["120", "1,200", "45"])
  },
  {
    id: "reorder",
    hidden: true,
    label: "Reorder at",
    align: "right",
    match: matched("Reorder point", ["20", "200", "10"])
  },
  {
    id: "cost",
    label: "Cost",
    align: "right",
    match: matched("Unit cost", ["$4.85", "$0.18", "$3.40"])
  },
  {
    id: "supplier",
    facet: true,
    context: true,
    label: "Supplier",
    match: matched("Vendor", ["Harlow Steel", "Tri-County Fasteners", "Weldcraft Supply"], "model")
  },
  { id: "bin", code: true, hidden: true, label: "Bin", match: matched("Bin", ["A-04", "C-11", "D-02"]) },
  {
    id: "lead",
    hidden: true,
    label: "Lead time",
    unit: "days",
    align: "right",
    match: matched("Lead time (days)", ["5", "3", "7"])
  }
]

/** The same columns with Unit tied between two file columns, so the import is blocked until the person picks. */
export const columnsUnmatched: ReadonlyArray<ReviewColumn> = columns.map((column) =>
  column.id === "unit"
    ? {
        ...column,
        match: {
          state: "unmatched",
          candidates: [
            { source: "UOM", samples: ["m", "PCS", "kg"] },
            { source: "Pack", samples: ["bundle", "box 100", "spool"] }
          ]
        }
      }
    : column
)

type Family = {
  name: string
  code: string
  category: string
  unit: (typeof units)[number]
  supplier: string
  sizes: ReadonlyArray<readonly [label: string, code: string]>
  cost: number
}

const pairs = (list: ReadonlyArray<string>): ReadonlyArray<readonly [string, string]> =>
  list.map(
    (label) => [label, label.replace(/ mm$/, "").replace(/ × /g, "-").replace(/ /g, "-").replace(/\./g, "")] as const
  )

const families: ReadonlyArray<Family> = [
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

type Role = "each" | "length" | "cost" | "copyA" | "copyB" | "below" | "name" | "kg" | "pcs" | "clean"

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

const eachFix = (from: string): Fix => ({
  column: "unit",
  to: "pcs",
  by: "rule",
  confidence: "high",
  kind: "unit",
  group: "unit:each",
  why: { basis: `"${from}" means each: one piece.`, detail: "Matched against your unit list: pcs, kg, m, L." }
})

const lengthFix: Fix = {
  column: "unit",
  to: "pcs",
  by: "model",
  confidence: "low",
  kind: "unit",
  group: "unit:length",
  why: {
    basis: "A stock length is usually one piece.",
    detail: "Choose m if you count this stock in metres. Only the unit changes; quantities stay as they are.",
    alternatives: ["m"]
  }
}

const caseFix = (to: "kg" | "pcs"): Fix => ({
  column: "unit",
  to,
  by: "rule",
  confidence: "high",
  kind: "unit",
  group: `unit:case:${to}`,
  why: { basis: `The same unit as ${to}, spelled another way.` }
})

/** The file as the review reads it: `size` rows, the same mix in every block of 178. `clean` removes every problem. */
export function makeRows(input: { size: number; clean?: boolean; withoutUnit?: boolean }): ReadonlyArray<ReviewRow> {
  const rows: Array<ReviewRow> = []
  const used = MutableHashMap.empty<string, number>()
  for (let position = 0; position < input.size; position += 1) {
    const rank = rankOf(position % block)
    const lot = Math.floor(position / block)
    const role: Role = input.clean === true ? "clean" : roleOf(rank)
    // The role picks the kind of item so the mess is believable: bolts counted "each", bar bought in "lengths".
    const pool =
      role === "each" || role === "pcs"
        ? families.filter((family) => family.unit === "pcs")
        : role === "length"
          ? families.filter((family) => family.unit === "m")
          : role === "kg"
            ? families.filter((family) => family.unit === "kg")
            : families
    const family = pool[position % pool.length] ?? families[0]!
    const turn = Option.getOrElse(MutableHashMap.get(used, family.code), () => 0)
    MutableHashMap.set(used, family.code, turn + 1)
    const size = family.sizes[turn % family.sizes.length] ?? family.sizes[0]!
    const series = Math.floor(turn / family.sizes.length)
    const suffix =
      series === 0 ? "" : ` / ${String.fromCharCode(65 + (series % 26))}${series > 25 ? Math.floor(series / 26) : ""}`
    const id = `r${position + 1}`
    const line = position + 2
    const onHand = ((position * 37) % 23) * (family.unit === "pcs" ? 50 : 5) + (family.unit === "pcs" ? 100 : 10)
    const cells: Record<string, string> = {
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
    let problem: Problem | undefined
    let applied: ReadonlyArray<Fix> | undefined
    switch (role) {
      case "each": {
        cells.unit = rank < 6 ? "ea" : "each"
        problem = { kind: "unit", column: "unit", fix: eachFix(cells.unit) }
        break
      }
      case "length": {
        cells.unit = "length"
        problem = { kind: "unit", column: "unit", fix: lengthFix }
        break
      }
      case "cost": {
        cells.cost = ""
        problem = { kind: "cost", column: "cost", ask: "Type a cost" }
        break
      }
      case "copyA":
      case "copyB": {
        // Ranks pair up (21 with 22, 23 with 24, ...): the later row repeats the earlier row's SKU.
        const otherRank = role === "copyA" ? rank + 1 : rank - 1
        const otherPosition = lot * block + ((otherRank * 51) % block)
        if (otherPosition >= input.size) break
        problem = {
          kind: "copy",
          column: "sku",
          ask: "Type a new SKU",
          rivals: [`r${otherPosition + 1}`]
        }
        break
      }
      case "below": {
        cells.onHand = `-${(position % 9) + 3}`
        problem = { kind: "below", column: "onHand", ask: "Type the count" }
        break
      }
      case "name": {
        cells.name = ""
        problem = {
          kind: "name",
          column: "name",
          fix: {
            column: "name",
            to: cells.sku ?? "",
            by: "rule",
            confidence: "medium",
            kind: "name",
            why: {
              basis: "The file has no name for this row.",
              detail: "Its SKU is the only label it has, so the SKU is offered as the name."
            }
          }
        }
        break
      }
      case "kg": {
        cells.unit = rank < 47 ? "KG" : "Kgs"
        applied = [caseFix("kg")]
        break
      }
      case "pcs": {
        cells.unit = rank < 56 ? "PCS" : "Pcs."
        applied = [caseFix("pcs")]
        break
      }
      case "clean":
        break
    }
    if (input.withoutUnit === true) {
      cells.unit = ""
      applied = undefined
      if (problem?.kind === "unit") problem = undefined
    }
    rows.push({
      id,
      line,
      cells,
      ...(applied === undefined ? {} : { applied }),
      ...(problem === undefined ? {} : { problem })
    })
  }
  // The guess for "length" is made from the file, not from a sentence: which unit the other rows of the same
  // categories use decides what is suggested, and the count is the basis shown to the person.
  const guessed = rows.filter((row) => row.problem?.fix?.group === "unit:length")
  if (guessed.length > 0) {
    const categories = Arr.dedupe(guessed.map((row) => row.cells.category ?? ""))
    const tally = MutableHashMap.empty<string, number>()
    const counted = (unit: string): number => Option.getOrElse(MutableHashMap.get(tally, unit), () => 0)
    for (const row of rows) {
      const unit = row.cells.unit ?? ""
      if (row.problem !== undefined || row.applied !== undefined) continue
      if (!categories.includes(row.cells.category ?? "") || (unit !== "m" && unit !== "pcs")) continue
      MutableHashMap.set(tally, unit, counted(unit) + 1)
    }
    const m = counted("m")
    const pcs = counted("pcs")
    const [to, other] = m >= pcs ? (["m", "pcs"] as const) : (["pcs", "m"] as const)
    const fix: Fix = {
      ...lengthFix,
      to,
      why: {
        basis: `${Math.max(m, pcs)} other ${categories.join(" and ")} rows in this file use ${to}; ${Math.min(m, pcs)} use ${other}.`,
        detail: "Only the unit changes; quantities stay as they are.",
        alternatives: [other]
      }
    }
    for (const [index, row] of rows.entries()) {
      if (row.problem?.fix?.group === "unit:length") rows[index] = { ...row, problem: { ...row.problem, fix } }
    }
  }
  // The later row of each pair repeats the earlier row's SKU: that is what makes them copies.
  const byId = MutableHashMap.fromIterable(rows.map((row) => [row.id, row] as const))
  return rows.map((row) => {
    const rival = row.problem?.rivals?.[0]
    const other = rival === undefined ? undefined : Option.getOrUndefined(MutableHashMap.get(byId, rival))
    if (other === undefined || other.line > row.line) return row
    return { ...row, cells: { ...row.cells, sku: other.cells.sku ?? "" } }
  })
}

/** The gallery's pure check of one row after the person typed a value. Copies need the whole file, so not here. */
export function recheck(input: { row: ReviewRow; cells: Readonly<Record<string, string>> }): Problem | undefined {
  const { cells } = input
  if ((cells.name ?? "").trim() === "") return { kind: "name", column: "name" }
  if (!(units as ReadonlyArray<string>).includes(cells.unit ?? "")) return { kind: "unit", column: "unit" }
  if (!/^\$?\d[\d,]*(\.\d+)?$/.test((cells.cost ?? "").trim())) return { kind: "cost", column: "cost" }
  if ((cells.onHand ?? "").trim().startsWith("-")) return { kind: "below", column: "onHand" }
  return undefined
}

export const activity = (rows: number): Activity => ({
  steps: [
    {
      id: "read",
      by: "read",
      label: `Read ${whole.format(rows)} rows and 10 columns`,
      detail: "items.csv, first sheet, header on line 1"
    },
    { id: "match", by: "rule", label: "Matched 8 columns by name", detail: "Exact after trimming case and spaces" },
    {
      id: "match-model",
      by: "model",
      label: "Matched 2 columns by meaning",
      detail: "Group → Category, Vendor → Supplier"
    },
    { id: "fix", by: "rule", label: "Applied 17 spelling fixes", detail: "KG, Kgs → kg · PCS, Pcs. → pcs" },
    { id: "flag", by: "rule", label: "Flagged 42 rows", detail: "Unit, cost, SKU, stock level and name checks" },
    {
      id: "propose",
      by: "model",
      label: "Guessed a unit for 3 rows",
      detail: "length → pcs or m, low confidence: left for you to choose"
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
