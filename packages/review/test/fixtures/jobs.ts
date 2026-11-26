import { cycle } from "./cycle.ts"
import { identity } from "effect/Function"
import * as R from "effect/Record"
import * as S from "effect/Schema"
/**
 * Made-up jobs for the same fabrication shop, for the gallery's "Records with a parent" state and its tests: each job
 * (the parent record) lists the material it needs, one line each. Development only: nothing in the app imports this.
 * 24 jobs and 132 lines; 9 lines need the person, on 8 jobs, across three kinds:
 * a unit to pick with no default (`choices`, one suggested), a quantity with a decimal comma (one `label`ed group
 * whose rows end in different values), and a SKU that is not on the item list (type one, or leave the job out).
 */
import * as O from "effect/Option"
import * as A from "effect/Array"
import { Choice, Fix, Problem, ProblemKind, ReviewColumn, ReviewRow } from "@inventory/review/ReviewTypes"
import type { RowDecision, SavedDecisions } from "@inventory/review/ReviewTypes"

export const lineKinds: ReadonlyArray<ProblemKind> = [
  ProblemKind.make({
    id: "unit",
    label: "Unit to pick",
    tone: "decision",
    help: O.some("The file says “length”. Pick the unit the job counts it in."),
    fixable: true
  }),
  ProblemKind.make({
    id: "comma",
    label: "Decimal comma",
    tone: "decision",
    help: O.some("The quantity is written with a comma."),
    fixable: true
  }),
  ProblemKind.make({
    id: "stock",
    label: "Not in stock",
    tone: "blocker",
    help: O.some("The SKU is not on your item list. Type one, or leave it out."),
    fixable: true
  })
]

export const lineColumns: ReadonlyArray<ReviewColumn> = [
  ReviewColumn.make({
    display: identity,
    id: "material",
    label: "Material",
    size: "fill",
    width: O.some(200),
    core: true
  }),
  ReviewColumn.make({
    display: identity,
    id: "job",
    label: "Job",
    core: true,
    code: true,
    context: true,
    search: true
  }),
  ReviewColumn.make({
    display: identity,
    id: "sku",
    label: "SKU",
    core: true,
    code: true,
    under: true,
    search: true,
    context: true
  }),
  ReviewColumn.make({ display: identity, id: "qty", label: "Qty", core: true, align: O.some("right") }),
  ReviewColumn.make({ display: identity, id: "unit", label: "Unit", core: true })
]

type Material = { readonly name: string; readonly sku: string; readonly unit: "m" | "pcs" | "kg" | "L" }

const materials: A.NonEmptyReadonlyArray<Material> = [
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

export type Job = {
  readonly code: string
  readonly making: string
  readonly due: string
  readonly lines: ReadonlyArray<Line>
}

/** One line of the file: a material a job needs. `problem` when the person has to answer for it. */
const Line = S.Struct({
  line: S.Finite.annotateKey({ description: "Line in the file, counting the header" }),
  job: S.String.annotateKey({ description: "Parent job code" }),
  material: S.String.annotateKey({ description: "Material name" }),
  sku: S.String.annotateKey({ description: "Stock code" }),
  qty: S.String.annotateKey({ description: "Quantity as written" }),
  unit: S.String.annotateKey({ description: "Unit as written" }),
  problem: S.OptionFromOptionalKey(Problem).annotateKey({ description: "Question on this line" })
})
export type Line = typeof Line.Type

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
const commas: A.NonEmptyReadonlyArray<readonly [qty: string, material: Material]> = [
  ["1,5", { name: "Flat bar 40 × 5", sku: "FB-40-5", unit: "m" }],
  ["2,25", { name: "Weld wire ER70S 0.9 mm", sku: "WW-ER70S-09", unit: "kg" }],
  ["0,75", { name: "Primer grey 5 L tin", sku: "PG-5-L-tin", unit: "L" }]
]
const days = ["Mon 23 Nov", "Tue 24 Nov", "Wed 25 Nov", "Thu 26 Nov", "Fri 27 Nov", "Mon 30 Nov", "Tue 1 Dec"] as const
// Material the shop does not stock: the SKU is not on the item list.
const strangers: A.NonEmptyReadonlyArray<Material> = [
  { name: "Hex bolt M8 × 90", sku: "HB-M8-90", unit: "pcs" },
  { name: "Square tube 45 × 2", sku: "ST-45-2", unit: "m" },
  { name: "Zinc primer 2 L tin", sku: "PG-zinc-2L", unit: "L" }
]

// The immutable source cycles select each job's members once; each generation below still makes fresh jobs and lines.
const jobPlans = A.map(making, (what, index) => ({
  what,
  due: cycle(days, index * 2),
  lines: A.makeBy(4 + ((index * 5) % 4), (at) => {
    const material = cycle(materials, index * 3 + at * 7)
    const qty = material.unit === "pcs" ? String(8 + ((index + at) % 5) * 4) : String(2 + ((index * at) % 5))
    // The source plan is fixed; generation still constructs each row afresh.
    const unit = material.unit === "m" && (index + at) % 6 === 0 ? "pcs" : material.unit
    return { job: `J-${2041 + index}`, material: material.name, sku: material.sku, qty, unit }
  })
}))

/** The file as the page reads it: 24 jobs, 4 to 7 lines each, the same every time. */
export function makeJobs(): ReadonlyArray<Job> {
  let line = 2
  const jobs = A.map(jobPlans, ({ what, due, lines: planned }, index) => {
    const lines: Array<Line> = []
    for (const source of planned) {
      lines.push(
        Line.make({
          line,
          job: source.job,
          material: source.material,
          sku: source.sku,
          qty: source.qty,
          unit: source.unit,
          problem: O.none()
        })
      )
      line += 1
    }
    return { code: `J-${2041 + index}`, making: what, due, lines }
  })
  // The questions, then the suggestion for a unit: what the other lines with that SKU say.
  let comma = 0
  let stranger = 0
  for (const [jobAt, lineAt, kind] of questions) {
    const foundJob = A.get(jobs, jobAt)
    const foundTarget = O.flatMap(foundJob, (job) => A.get(job.lines, lineAt))
    O.map(O.all({ job: foundJob, target: foundTarget }), ({ job, target }) => {
      const lines = [...job.lines]
      if (kind === "unit") {
        const bar = cycle(materials, (jobAt + lineAt) % 4)
        lines[lineAt] = {
          ...target,
          material: bar.name,
          sku: bar.sku,
          unit: "length",
          problem: Problem.makeOption({ kind: "unit", column: O.some("unit"), ask: O.some("Pick a unit") })
        }
      }
      if (kind === "comma") {
        const [qty, material] = cycle(commas, comma)
        comma += 1
        const to = qty.replace(",", ".")
        lines[lineAt] = {
          ...target,
          material: material.name,
          sku: material.sku,
          unit: material.unit,
          qty,
          problem: Problem.makeOption({
            kind: "comma",
            column: O.some("qty"),
            fix: O.some(
              Fix.make({
                column: "qty",
                to,
                label: O.some("a decimal point"),
                by: O.some("rule"),
                confidence: O.some("high"),
                kind: "comma",
                group: O.some("qty:comma"),
                why: {
                  basis: `"${qty}" is ${to} written with a decimal comma.`,
                  detail: O.some("Every other quantity in the file uses a point.")
                }
              })
            )
          })
        }
      }
      if (kind === "stock") {
        const material = cycle(strangers, stranger)
        stranger += 1
        lines[lineAt] = {
          ...target,
          material: material.name,
          sku: material.sku,
          unit: material.unit,
          problem: Problem.makeOption({ kind: "stock", column: O.some("sku"), ask: O.some("Type a SKU") })
        }
      }
      job.lines = lines
    })
  }
  const all = jobs.flatMap((job) => job.lines)
  for (const job of jobs) {
    job.lines = job.lines.map((entry) => ({
      ...entry,
      problem: O.map(entry.problem, (problem) =>
        problem.kind === "unit" ? { ...problem, choices: O.some(unitChoices(entry, all)) } : problem
      )
    }))
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
      ? Choice.make({
          value: "m",
          label: "m",
          suggested,
          note: O.some(`as ${metres} of ${total} lines with this SKU say`)
        })
      : Choice.make({ value: "m", label: "m" }),
    Choice.make({ value: "pcs", label: "pcs" })
  ]
}

/** The region's rows: one per line that needs the person, for the jobs that are not left out. */
export const questionRows = (jobs: ReadonlyArray<Job>, leftOut: ReadonlyArray<string>): ReadonlyArray<ReviewRow> =>
  jobs
    .filter((job) => !leftOut.includes(job.code))
    .flatMap((job) => job.lines)
    .flatMap((entry) =>
      O.match(entry.problem, {
        onNone: A.empty,
        onSome: (problem) => [
          ReviewRow.make({
            id: `line-${entry.line}`,
            line: entry.line,
            cells: { material: entry.material, job: entry.job, sku: entry.sku, qty: entry.qty, unit: entry.unit },
            problem: O.some(problem)
          })
        ]
      })
    )

/** The page's own check of a line after the person typed or picked a value: the same rule the server would run. */
export function recheckLine(input: { readonly cells: Readonly<Record<string, string>> }): O.Option<Problem> {
  const { cells } = input
  if (!O.exists(R.get(cells, "sku"), (sku) => knownSkus.includes(sku)))
    return Problem.makeOption({ kind: "stock", column: O.some("sku"), ask: O.some("Type a SKU") })
  if (!O.exists(R.get(cells, "qty"), (qty) => /^\d+(\.\d+)?$/.test(qty)))
    return Problem.makeOption({ kind: "comma", column: O.some("qty") })
  if (!O.exists(R.get(cells, "unit"), (unit) => ["m", "pcs", "kg", "L"].includes(unit)))
    return Problem.makeOption({ kind: "unit", column: O.some("unit") })
  return O.none()
}

/** Whether the person's decision settles a line's question, and how: the page counts from this, not the region. */
const answerOf = (entry: Line, decision: O.Option<RowDecision>): "open" | "answered" | "out" =>
  O.match(entry.problem, {
    onNone: () => "answered",
    onSome: (problem) =>
      O.match(decision, {
        onNone: () => "open",
        onSome: (decision) => {
          if (decision.place.kind === "leftOut") return "out"
          const column = O.match(problem.column, { onNone: () => "", onSome: identity })
          if (decision.accepted.includes(column)) return "answered"
          return O.match(R.get(decision.edits, column), {
            onNone: () => "open",
            onSome: (typed) => {
              const cells = {
                material: entry.material,
                job: entry.job,
                sku: entry.sku,
                qty: entry.qty,
                unit: entry.unit,
                [column]: typed
              }
              return O.match(recheckLine({ cells }), { onNone: () => "answered", onSome: () => "open" })
            }
          })
        }
      })
  })

export type JobReview = {
  readonly job: Job
  readonly status: "ready" | "waiting" | "out"
  /** One sentence: what the job waits on, or why it is ready. */
  readonly reason: string
  /** Lines that will be imported with it. */
  readonly importing: number
  readonly waiting: number
}

const lines = (n: number) => `${n} ${n === 1 ? "line" : "lines"}`

/** The page's pure review of the jobs: what each becomes, from the person's answers on its lines. */
export function reviewJobs(input: {
  readonly jobs: ReadonlyArray<Job>
  readonly decisions: SavedDecisions
  readonly leftOut: ReadonlyArray<string>
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
      answer: answerOf(entry, R.get(input.decisions, `line-${entry.line}`))
    }))
    const open = answers.filter((item) => item.answer === "open")
    const out = answers.filter((item) => item.answer === "out").length
    const importing = answers.length - out - open.length
    if (open.length > 0) {
      const what = open.map(({ entry }, index) =>
        O.match(entry.problem, {
          onNone: () =>
            `${index === 0 ? "Line" : "line"} ${entry.line} asks for ${entry.sku}, which is not on your item list: type the SKU or leave the job out`,
          onSome: (problem) => {
            if (problem.kind === "unit") {
              const hint = O.flatMap(
                problem.choices,
                A.findFirst((choice) => choice.suggested)
              )
              return O.match(hint, {
                onNone: () =>
                  `${index === 0 ? "Line" : "line"} ${entry.line} says “length” for ${entry.material}: pick m or pcs`,
                onSome: (hint) =>
                  `${index === 0 ? "Line" : "line"} ${entry.line} says “length” for ${entry.material}: pick m or pcs (${hint.label}, ${O.match(hint.note, { onNone: () => "suggested", onSome: (note) => note })})`
              })
            }
            if (problem.kind === "comma")
              return O.match(problem.fix, {
                onNone: () =>
                  `${index === 0 ? "Line" : "line"} ${entry.line} has ${entry.qty} ${entry.unit} of ${entry.material}, a decimal comma the fix reads as `,
                onSome: (fix) =>
                  `${index === 0 ? "Line" : "line"} ${entry.line} has ${entry.qty} ${entry.unit} of ${entry.material}, a decimal comma the fix reads as ${fix.to}`
              })
            return `${index === 0 ? "Line" : "line"} ${entry.line} asks for ${entry.sku}, which is not on your item list: type the SKU or leave the job out`
          }
        })
      )
      const reason = `${what.join("; ")}.`
      return {
        job,
        status: "waiting",
        reason,
        importing,
        waiting: open.length
      }
    }
    const answered = answers.filter((item) => O.isSome(item.entry.problem) && item.answer === "answered").length
    const reason =
      answered === 0 && out === 0
        ? `All ${lines(job.lines.length)} match an item on your list, in the unit it is stocked in.`
        : `${lines(importing)} will be imported${answered > 0 ? `, ${answered} answered by you` : ""}${out > 0 ? `; ${lines(out)} left out by you` : ""}.`
    return { job, status: "ready", reason, importing, waiting: 0 }
  })
}
