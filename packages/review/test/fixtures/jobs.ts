/**
 * Made-up jobs for the same fabrication shop, for the gallery's "Records with a parent" state and its tests: each job
 * (the parent record) lists the material it needs, one line each. Development only: nothing in the app imports this.
 * 24 jobs and 132 lines; 9 lines need the person, on 8 jobs, across three kinds:
 * a unit to pick with no default (`choices`, one suggested), a quantity with a decimal comma (one `label`ed group
 * whose rows end in different values), and a SKU that is not on the item list (type one, or leave the job out).
 */
import * as O from "effect/Option"
import type {
  Choice,
  Problem,
  ProblemKind,
  ReviewColumn,
  ReviewRow,
  RowDecision,
  SavedDecisions
} from "@inventory/review/ReviewTypes"

export const lineKinds: ReadonlyArray<ProblemKind> = [
  {
    id: "unit",
    label: "Unit to pick",
    tone: "decision",
    help: "The file says “length”. Pick the unit the job counts it in."
  },
  { id: "comma", label: "Decimal comma", tone: "decision", help: "The quantity is written with a comma." },
  {
    id: "stock",
    label: "Not in stock",
    tone: "blocker",
    help: "The SKU is not on your item list. Type one, or leave it out."
  }
]

export const lineColumns: ReadonlyArray<ReviewColumn> = [
  { id: "material", label: "Material", size: "fill", width: 200, core: true },
  { id: "job", label: "Job", core: true, code: true, context: true, search: true },
  { id: "sku", label: "SKU", core: true, code: true, under: true, search: true, context: true },
  { id: "qty", label: "Qty", core: true, align: "right" },
  { id: "unit", label: "Unit", core: true }
]

type Material = { name: string; sku: string; unit: "m" | "pcs" | "kg" | "L" }

const materials: ReadonlyArray<Material> = [
  { name: "Flat bar 40 × 5", sku: "FB-40-5", unit: "m" },
  { name: "Square tube 40 × 2", sku: "ST-40-2", unit: "m" },
  { name: "Angle 50 × 5", sku: "AN-50-5", unit: "m" },
  { name: "Round bar 16 mm", sku: "RB-16", unit: "m" },
  { name: "Hex bolt M8 × 30", sku: "HB-M8-30", unit: "pcs" },
  { name: "Hex nut M8", sku: "HN-M8", unit: "pcs" },
  { name: "Flat washer M8", sku: "FW-M8", unit: "pcs" },
  { name: "Weld wire ER70S 0.9 mm", sku: "WW-ER70S-09", unit: "kg" },
  { name: "Primer grey 5 L tin", sku: "PG-5-L-tin", unit: "L" },
  { name: "Cutting disc 125 × 1.0", sku: "CD-125-10", unit: "pcs" }
]

/** Every SKU on the shop's item list: a typed SKU is answered only when it is one of these. */
export const knownSkus: ReadonlyArray<string> = materials.map((material) => material.sku)

const making = [
  "Gate frame, 2 off",
  "Handrail, 12 m",
  "Machine guard",
  "Stair stringer pair",
  "Trailer drawbar",
  "Shelf brackets, 40 off",
  "Bin stand",
  "Fence panels, 6 off",
  "Ladder brackets",
  "Pallet rack shelf",
  "Bike rack",
  "Fire pit",
  "Workbench frame",
  "Mezzanine kick plate",
  "Hose reel bracket",
  "Canopy posts, 4 off",
  "Tow hitch plate",
  "Door jamb set",
  "Truck tray rails",
  "Pipe supports, 10 off",
  "Gate latch plates",
  "Bollards, 4 off",
  "Signpost brackets",
  "Barrow frame"
] as const

export type Job = { code: string; making: string; due: string; lines: ReadonlyArray<Line> }

/** One line of the file: a material a job needs. `problem` when the person has to answer for it. */
export type Line = {
  /** The line in the file, as the person would count it (the header is line 1). */
  line: number
  job: string
  material: string
  sku: string
  qty: string
  unit: string
  problem?: Problem
}

// Which line of which job carries a question, by job index and line index: spread through the file.
const questions: ReadonlyArray<readonly [job: number, line: number, kind: "unit" | "comma" | "stock"]> = [
  [1, 2, "unit"],
  [4, 0, "unit"],
  [9, 3, "unit"],
  [2, 1, "comma"],
  [6, 4, "comma"],
  [11, 2, "comma"],
  [4, 3, "stock"],
  [13, 1, "stock"],
  [16, 0, "stock"]
]
// A quantity with a decimal comma, on material bought by length, weight or volume.
const commas: ReadonlyArray<readonly [qty: string, material: Material]> = [
  ["1,5", { name: "Flat bar 40 × 5", sku: "FB-40-5", unit: "m" }],
  ["2,25", { name: "Weld wire ER70S 0.9 mm", sku: "WW-ER70S-09", unit: "kg" }],
  ["0,75", { name: "Primer grey 5 L tin", sku: "PG-5-L-tin", unit: "L" }]
]
const days = ["Mon 23 Nov", "Tue 24 Nov", "Wed 25 Nov", "Thu 26 Nov", "Fri 27 Nov", "Mon 30 Nov", "Tue 1 Dec"] as const
// Material the shop does not stock: the SKU is not on the item list.
const strangers: ReadonlyArray<Material> = [
  { name: "Hex bolt M8 × 90", sku: "HB-M8-90", unit: "pcs" },
  { name: "Square tube 45 × 2", sku: "ST-45-2", unit: "m" },
  { name: "Zinc primer 2 L tin", sku: "PG-zinc-2L", unit: "L" }
]

/** The file as the page reads it: 24 jobs, 4 to 7 lines each, the same every time. */
export function makeJobs(): ReadonlyArray<Job> {
  let line = 2
  const jobs = making.map((what, index) => {
    const count = 4 + ((index * 5) % 4)
    const lines: Array<Line> = []
    for (let at = 0; at < count; at += 1) {
      const material = materials[(index * 3 + at * 7) % materials.length] ?? materials[0]!
      const qty = material.unit === "pcs" ? String(8 + ((index + at) % 5) * 4) : String(2 + ((index * at) % 5))
      // Now and then a bar is counted in cut pieces, not metres: both are on the unit list.
      const unit = material.unit === "m" && (index + at) % 6 === 0 ? "pcs" : material.unit
      lines.push({ line, job: `J-${2041 + index}`, material: material.name, sku: material.sku, qty, unit })
      line += 1
    }
    const due = days[(index * 2) % days.length] ?? "Mon 23 Nov"
    return { code: `J-${2041 + index}`, making: what, due, lines }
  })
  // The questions, then the suggestion for a unit: what the other lines with that SKU say.
  let comma = 0
  let stranger = 0
  for (const [jobAt, lineAt, kind] of questions) {
    const job = jobs[jobAt]
    const target = job?.lines[lineAt]
    if (job === undefined || target === undefined) continue
    const lines = [...job.lines]
    if (kind === "unit") {
      const bar = materials[(jobAt + lineAt) % 4] ?? materials[0]!
      lines[lineAt] = {
        ...target,
        material: bar.name,
        sku: bar.sku,
        unit: "length",
        problem: { kind: "unit", column: "unit", ask: "Pick a unit" }
      }
    }
    if (kind === "comma") {
      const [qty, material] = commas[comma % commas.length] ?? ["1,5", materials[0]!]
      comma += 1
      const to = qty.replace(",", ".")
      lines[lineAt] = {
        ...target,
        material: material.name,
        sku: material.sku,
        unit: material.unit,
        qty,
        problem: {
          kind: "comma",
          column: "qty",
          fix: {
            column: "qty",
            to,
            label: "a decimal point",
            by: "rule",
            confidence: O.some("high"),
            kind: "comma",
            group: "qty:comma",
            why: {
              basis: `"${qty}" is ${to} written with a decimal comma.`,
              detail: "Every other quantity in the file uses a point."
            }
          }
        }
      }
    }
    if (kind === "stock") {
      const material = strangers[stranger % strangers.length] ?? strangers[0]!
      stranger += 1
      lines[lineAt] = {
        ...target,
        material: material.name,
        sku: material.sku,
        unit: material.unit,
        problem: { kind: "stock", column: "sku", ask: "Type a SKU" }
      }
    }
    job.lines = lines
  }
  const all = jobs.flatMap((job) => job.lines)
  for (const job of jobs) {
    job.lines = job.lines.map((entry) =>
      entry.problem?.kind === "unit"
        ? { ...entry, problem: { ...entry.problem, choices: unitChoices(entry, all) } }
        : entry
    )
  }
  return jobs
}

/** m or pcs, with the unit the file's other lines for this SKU use as the suggestion, and how many say so. */
const unitChoices = (target: Line, all: ReadonlyArray<Line>): ReadonlyArray<Choice> => {
  const others = all.filter(
    (entry) => entry.sku === target.sku && entry.line !== target.line && entry.unit !== "length"
  )
  const metres = others.filter((entry) => entry.unit === "m").length
  const total = others.length
  const suggested = total > 0 && metres * 2 > total
  return [
    suggested
      ? { value: "m", label: "m", suggested, note: `as ${metres} of ${total} lines with this SKU say` }
      : { value: "m", label: "m" },
    { value: "pcs", label: "pcs" }
  ]
}

/** The region's rows: one per line that needs the person, for the jobs that are not left out. */
export const questionRows = (jobs: ReadonlyArray<Job>, leftOut: ReadonlyArray<string>): ReadonlyArray<ReviewRow> =>
  jobs
    .filter((job) => !leftOut.includes(job.code))
    .flatMap((job) => job.lines)
    .flatMap((entry) =>
      entry.problem === undefined
        ? []
        : [
            {
              id: `line-${entry.line}`,
              line: entry.line,
              cells: { material: entry.material, job: entry.job, sku: entry.sku, qty: entry.qty, unit: entry.unit },
              problem: entry.problem
            }
          ]
    )

/** The page's own check of a line after the person typed or picked a value: the same rule the server would run. */
export function recheckLine(input: { cells: Readonly<Record<string, string>> }): Problem | undefined {
  const { cells } = input
  if (!knownSkus.includes(cells.sku ?? "")) return { kind: "stock", column: "sku", ask: "Type a SKU" }
  if (!/^\d+(\.\d+)?$/.test(cells.qty ?? "")) return { kind: "comma", column: "qty" }
  if (!["m", "pcs", "kg", "L"].includes(cells.unit ?? "")) return { kind: "unit", column: "unit" }
  return undefined
}

/** Whether the person's decision settles a line's question, and how: the page counts from this, not the region. */
const answerOf = (entry: Line, decision: RowDecision | undefined): "open" | "answered" | "out" => {
  if (entry.problem === undefined) return "answered"
  if (decision !== undefined && decision.place.kind === "leftOut") return "out"
  const column = entry.problem.column ?? ""
  const typed = decision?.edits?.[column]
  if (decision?.accepted?.includes(column) === true) return "answered"
  if (typed === undefined) return "open"
  const cells = {
    material: entry.material,
    job: entry.job,
    sku: entry.sku,
    qty: entry.qty,
    unit: entry.unit,
    [column]: typed
  }
  return recheckLine({ cells }) === undefined ? "answered" : "open"
}

export type JobReview = {
  job: Job
  status: "ready" | "waiting" | "out"
  /** One sentence: what the job waits on, or why it is ready. */
  reason: string
  /** Lines that will be imported with it. */
  importing: number
  waiting: number
}

const lines = (n: number) => `${n} ${n === 1 ? "line" : "lines"}`

/** The page's pure review of the jobs: what each becomes, from the person's answers on its lines. */
export function reviewJobs(input: {
  jobs: ReadonlyArray<Job>
  decisions: SavedDecisions
  leftOut: ReadonlyArray<string>
}): ReadonlyArray<JobReview> {
  return input.jobs.map((job) => {
    if (input.leftOut.includes(job.code)) {
      return {
        job,
        status: "out",
        reason: "You left this job out: none of its lines will be imported.",
        importing: 0,
        waiting: 0
      }
    }
    const answers = job.lines.map((entry) => ({
      entry,
      answer: answerOf(entry, input.decisions[`line-${entry.line}`])
    }))
    const open = answers.filter((item) => item.answer === "open")
    const out = answers.filter((item) => item.answer === "out").length
    const importing = answers.length - out - open.length
    if (open.length > 0) {
      const what = open.map(({ entry }) => {
        const problem = entry.problem
        if (problem?.kind === "unit") {
          const hint = problem.choices?.find((choice) => choice.suggested === true)
          const why = hint === undefined ? "" : ` (${hint.label}, ${hint.note ?? "suggested"})`
          return `line ${entry.line} says “length” for ${entry.material}: pick m or pcs${why}`
        }
        return problem?.kind === "comma"
          ? `line ${entry.line} has ${entry.qty} ${entry.unit} of ${entry.material}, a decimal comma the fix reads as ${problem.fix?.to ?? ""}`
          : `line ${entry.line} asks for ${entry.sku}, which is not on your item list: type the SKU or leave the job out`
      })
      const reason = `${what.join("; ")}.`
      return {
        job,
        status: "waiting",
        reason: `${reason.charAt(0).toUpperCase()}${reason.slice(1)}`,
        importing,
        waiting: open.length
      }
    }
    const answered = answers.filter((item) => item.entry.problem !== undefined && item.answer === "answered").length
    const reason =
      answered === 0 && out === 0
        ? `All ${lines(job.lines.length)} match an item on your list, in the unit it is stocked in.`
        : `${lines(importing)} will be imported${answered > 0 ? `, ${answered} answered by you` : ""}${out > 0 ? `; ${lines(out)} left out by you` : ""}.`
    return { job, status: "ready", reason, importing, waiting: 0 }
  })
}
