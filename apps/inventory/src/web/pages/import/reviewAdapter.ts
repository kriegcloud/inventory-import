// Turns the domain's review into what the review region takes, and back. The region holds no item words; this file
// holds no rules. The one thing a reader must not break: a row's `problem` is always the first thing still open
// *given the decisions so far*, because the region re-checks a row only after the person types, not after they
// accept a fix.
import { Option } from "effect"
import type {
  Choice,
  Fix,
  Problem as RegionProblem,
  ProblemKind,
  ReviewColumn,
  ReviewRow,
  SavedDecisions as RegionDecisions
} from "@inventory/review/ReviewTypes"
import { fromFlags, toFlags } from "@inventory/review/ReviewDecision"
import {
  type Problem,
  problemKinds,
  type Proposal,
  type Review,
  type ReviewedRow,
  rowPlace
} from "../../../domain/ItemImport.ts"
import {
  decisionFromFlags,
  decisionOf,
  decisionToFlags,
  hasKeep,
  type SavedDecisions
} from "@inventory/catalog-contract/Decision"
import { type ColumnMatch, matchedColumn } from "@inventory/catalog-contract/Mapping"
import {
  type Field,
  fieldLabels,
  requiredFields,
  type StagedColumn,
  type StagedTable
} from "@inventory/catalog-contract/Staged"
import { costText, countText, dimensionsCellText, tagsCellText, vendorsCellText } from "./itemText.ts"

/** The problem kinds in the region's shape, in the order their headings show. */
export const regionKinds: ReadonlyArray<ProblemKind> = problemKinds.map((kind) => ({
  id: kind.id,
  label: kind.label,
  tone: kind.tone
}))

// Spaces round a SKU end in a different value on every row (" BLT-0042" is "BLT-0042", "XRR-0266 " is "XRR-0266"), so the
// rule's own groups would be one row each. One group per column, named by what the fix does, settles them all at once;
// each row still shows its own old and new value and is given its own.
const trimLabel = "the value without its spaces"

const toFix = (proposal: Proposal, reason?: string): Fix => ({
  ...(reason === undefined ? {} : { reason }),
  column: proposal.field,
  to: proposal.to,
  by: proposal.by,
  confidence: proposal.confidence,
  kind: proposal.kind,
  ...(proposal.kind === "spaces" ? { group: `${proposal.field}:trim`, label: trimLabel } : { group: proposal.group }),
  why: {
    basis: proposal.basis,
    // What each value means, when the values do not speak for themselves ("2024-04-06 (month first)"): the words on
    // the buttons that take them.
    ...(proposal.labels.length === 0 ? {} : { labels: proposal.labels }),
    ...(proposal.alternatives.length === 0 ? {} : { alternatives: proposal.alternatives }),
    // An answer that writes another column ("No discontinued date" on a question asked on Active): the region
    // writes it there as a typed value, which the domain's `recheckRow` and the commit read alike.
    ...(proposal.targets.length === 0 ? {} : { targets: proposal.targets })
  }
})

/**
 * The column the region records "keep the stored item" or "replace it" under. It is no field of an item: the region
 * knows a choice only as the person's own value for a column, and the server keeps this one apart from the typed
 * values (`RowDecision.stored`). `toServerDecisions` and `toRegionDecisions` carry it across.
 */
export const storedChoice = "storedItem"

const storedWords: Readonly<Record<string, string>> = {
  keep: "Keep the stored item",
  replace: "Replace it with this row"
}

/**
 * The values a person picks from when a cell has to be one of a short list and no rule has a reading of it: the
 * categories, the units of measure, true or false, or what to do with a stored item that differs. The list is the
 * domain's (`Problem.choices`). None is proposed in the cell and none is suggested.
 */
const choicesFor = (
  problem: Problem
): { readonly ask: string; readonly choices: ReadonlyArray<Choice> } | undefined => {
  if (problem.proposal !== null || problem.field === null || problem.choices.length === 0) return undefined
  return {
    // Keep or replace is a choice about the stored item, not a value of the SKU the problem sits on.
    ask:
      problem.kind === "changed"
        ? "Keep or replace"
        : (problem.ask ?? `Choose ${fieldLabels[problem.field].toLowerCase()}`),
    choices: problem.choices.map((value) => ({ value, label: storedWords[value] ?? value }))
  }
}

/**
 * A domain problem as the region shows it. Its proposal rides along as the fix; a value with no proposal that has to
 * be one of a short list is a pick between equal buttons (`choices`) instead of a box to type in.
 */
export const toRegionProblem = (
  problem: Problem,
  options: { readonly withoutRivals?: boolean } = {}
): RegionProblem => {
  const pick = choicesFor(problem)
  return {
    kind: problem.kind,
    // Each problem's own tone: a SKU in lower case is a decision, a SKU "ab-12" must be typed again.
    tone: problem.tone,
    // The domain's sentence names the column and the value: every row says why, with a fix or without one.
    reason: problem.message,
    // Keep or replace is no value of the SKU: it goes under its own column (`storedChoice`).
    ...(problem.kind === "changed"
      ? { column: storedChoice }
      : problem.field === null
        ? {}
        : { column: problem.field }),
    ...(pick !== undefined
      ? { ask: pick.ask, choices: pick.choices }
      : problem.ask === null
        ? {}
        : { ask: problem.ask }),
    ...(problem.note === null ? {} : { note: problem.note }),
    ...(problem.proposal === null ? {} : { fix: toFix(problem.proposal) }),
    ...(problem.rivals.length === 0 || options.withoutRivals === true ? {} : { rivals: problem.rivals })
  }
}

/**
 * A row's reason on screen: its first problem's sentence and, when the row has more, how many more wait behind it
 * (`ReviewedRow.reasons` holds one sentence per problem). They come up one at a time as each is settled.
 *
 * @example reasonShown("SKU is empty.", 3) // "SKU is empty. And 2 more."
 */
export const reasonShown = (first: string, count: number): string =>
  count > 1 ? `${first} And ${count - 1} more.` : first

const toRegionRow = (row: ReviewedRow, decisions: SavedDecisions): ReviewRow => {
  // One of several items on its line is named with the file's word for it ("8 · Feb") in the region's sentences.
  const where = {
    id: row.id,
    line: row.rowNumber,
    ...(row.partLabel === undefined ? {} : { label: rowPlace({ rowNumber: row.rowNumber, label: row.partLabel }) })
  }
  // Already stored: nothing to decide and nothing written; the region counts it apart under All with its tag.
  if (row.status === "already") return { ...where, cells: row.file, stored: true }
  const accepted = decisions[row.id]?.accepted ?? []
  // A lossless rule fix is always offered through `applied` (the region holds it back or puts it in force from
  // the decisions). A fix the person accepted joins them, so the region shows it in force and moves on.
  // Each carries the domain's sentence for the value it changes, so a fix held back for the person says why too.
  const applied = row.proposals
    .filter((proposal) => proposal.lossless || accepted.includes(proposal.field))
    .map((proposal) => {
      const message = row.problems.find((problem) => problem.field === proposal.field)?.message
      return toFix(proposal, message === undefined ? undefined : reasonShown(message, row.reasons.length))
    })
  const open = row.problems.find((problem) => problem.proposal === null || !problem.proposal.lossless)
  // The region settles a row with rivals by itself once the row is kept or a rival's SKU was typed. The server is
  // stricter (only the first kept row wins, and a typed SKU can collide again), so where the two would differ the
  // problem is handed over without its rivals and stays open until the domain says it is settled.
  const stricter =
    open !== undefined &&
    ((decisions[row.id] !== undefined && hasKeep(decisions[row.id] ?? decisionOf())) ||
      open.rivals.some((id) => decisions[id]?.edits["sku"] !== undefined))
  return {
    ...where,
    cells: row.file,
    // Where the domain counts the row: Cannot import when any problem needs a typed value, however the first reads.
    ...(row.status === "needs" ? { blocked: row.outcome === "cannot" } : {}),
    ...(applied.length === 0 ? {} : { applied }),
    ...(open === undefined
      ? {}
      : {
          problem: {
            ...toRegionProblem(open, { withoutRivals: stricter }),
            reason: reasonShown(open.message, row.reasons.length)
          }
        })
  }
}

/**
 * The rows the person reviews: every item row of the file, the ones whose SKU is already stored as `stored` rows
 * (counted apart, nothing to decide), so the tabs add up to the file and a second load of the same file says so.
 */
export const toRegionRows = (current: Review, decisions: SavedDecisions): ReadonlyArray<ReviewRow> =>
  current.rows.map((row) => toRegionRow(row, decisions))

const isStoredChoice = (value: string | undefined): value is "keep" | "replace" =>
  value === "keep" || value === "replace"

/**
 * The region's decisions as the server takes them: the region's `ReviewDecision` as the flags the server stores, and a
 * keep-or-replace answer moved from the typed values (`edits[storedChoice]`) to `stored`, where the review reads it.
 */
export const toServerDecisions = (decisions: RegionDecisions): SavedDecisions =>
  Object.fromEntries(
    Object.entries(decisions).map(([id, decision]) => {
      // Through the flags the two share: the region's decision and the server's are stored in the same form.
      const flags = toFlags(decision)
      const answer = flags.edits?.[storedChoice]
      if (!isStoredChoice(answer)) return [id, decisionFromFlags(flags)]
      const { edits, ...rest } = flags
      const { [storedChoice]: _answer, ...typed } = edits ?? {}
      return [
        id,
        decisionFromFlags({ ...rest, ...(Object.keys(typed).length === 0 ? {} : { edits: typed }), stored: answer })
      ]
    })
  )

/** The server's decisions as the region holds them: the inverse of `toServerDecisions`. */
export const toRegionDecisions = (decisions: SavedDecisions): RegionDecisions =>
  Object.fromEntries(
    Object.entries(decisions).map(([id, decision]) => {
      const { stored, ...flags } = decisionToFlags(decision)
      return [
        id,
        fromFlags(stored === undefined ? flags : { ...flags, edits: { ...flags.edits, [storedChoice]: stored } })
      ]
    })
  )

// The name and the description are sentences: they share the room and end in an ellipsis, whole on hover. Every other
// column is as wide as its longest value, measured by the region, and never cut; short of room the lowest priority
// moves into the row's detail and the SKU under the name. What is drawn for a cost, the tags, the dimensions and the
// vendors is what the Items page draws; the file's text is what the checks and the edits see.
const layout: Record<Field, Omit<ReviewColumn, "id" | "label" | "match">> = {
  name: { size: "fill", width: 200, core: true },
  sku: { search: true, under: true, context: true, code: true, priority: 9 },
  category: { core: true, facet: true, priority: 8 },
  uom: { core: true, facet: true, context: true, priority: 8 },
  unitCost: { align: "right", core: true, priority: 7, display: costText },
  // A quantity is counted in the row's own unit of measure; an empty one is imported as the default the brief gives.
  quantityOnHand: { align: "right", priority: 6, unitFrom: "uom", byDefault: "0", display: countText },
  reorderPoint: { align: "right", priority: 3, unitFrom: "uom", display: countText },
  isActive: { priority: 4, byDefault: "true" },
  lotTracked: { priority: 2, byDefault: "false" },
  tags: { priority: 2, display: tagsCellText },
  firstReceivedOn: { priority: 3 },
  discontinuedOn: { priority: 4 },
  dimensions: { priority: 1, display: dimensionsCellText },
  vendors: { priority: 5, display: vendorsCellText },
  description: { size: "fill", width: 200, hidden: true }
}

const order: ReadonlyArray<Field> = [
  "name",
  "sku",
  "category",
  "uom",
  "unitCost",
  "quantityOnHand",
  "reorderPoint",
  "isActive",
  "lotTracked",
  "tags",
  "firstReceivedOn",
  "discontinuedOn",
  "dimensions",
  "vendors",
  "description"
]

/** Three values of a file column, for the person choosing which column feeds a field. */
const samplesOf = (table: StagedTable, index: number): ReadonlyArray<string> => {
  const seen: Array<string> = []
  for (const row of table.rows) {
    const cell = row.cells[index]
    const text = (cell?.shown ?? cell?.text ?? "").trim()
    if (text !== "" && !seen.includes(text)) seen.push(text)
    if (seen.length === 3) break
  }
  return seen
}

/**
 * Our fields as the region's columns, the name first, each saying which file column fed it. A required field with
 * no column is marked unmatched with the unused file columns as candidates: the region then asks for it before
 * anything can be imported.
 */
export const regionColumns = (
  mapping: ReadonlyArray<ColumnMatch>,
  unused: ReadonlyArray<StagedColumn>,
  table: StagedTable
): ReadonlyArray<ReviewColumn> => [
  ...itemColumns(mapping, unused, table),
  // Holds the answer for a row whose SKU is stored with other values; never a column of the file.
  { id: storedChoice, label: "Stored item", hidden: true }
]

const itemColumns = (
  mapping: ReadonlyArray<ColumnMatch>,
  unused: ReadonlyArray<StagedColumn>,
  table: StagedTable
): ReadonlyArray<ReviewColumn> =>
  order.map((field) => {
    const match = mapping.find((candidate) => candidate.field === field)
    const column = match === undefined ? Option.none() : matchedColumn(match)
    const missing = match !== undefined && Option.isNone(column) && requiredFields.includes(field) && unused.length > 0
    return {
      id: field,
      label: fieldLabels[field],
      ...layout[field],
      ...(Option.isNone(column)
        ? missing
          ? {
              match: {
                state: "unmatched" as const,
                candidates: unused.map((column) => ({ source: column.label, samples: samplesOf(table, column.index) }))
              }
            }
          : {}
        : {
            match: {
              state: "matched" as const,
              source: column.value.header,
              by: "name" as const,
              samples: column.value.examples
            }
          })
    }
  })
