import { identity } from "effect/Function"
// Turns the domain's review into what the review region takes, and back. The region holds no item words; this file
// holds no rules. The one thing a reader must not break: a row's `problem` is always the first thing still open
// *given the decisions so far*, because the region re-checks a row only after the person types, not after they
// accept a fix.
import * as A from "effect/Array"
import * as R from "effect/Record"
import * as O from "effect/Option"
import { filledAt } from "@inventory/catalog-model/CellRules"
import {
  Choice,
  ColumnMatch as RegionColumnMatch,
  Fix,
  Problem as RegionProblem,
  ProblemKind,
  ReviewColumn,
  ReviewRow
} from "@inventory/review/ReviewTypes"
import type { SavedDecisions as RegionDecisions } from "@inventory/review/ReviewTypes"
import { DecisionFlags, fromFlags, toFlags } from "@inventory/review/ReviewDecision"
import {
  type Problem,
  problemKinds,
  type Proposal,
  type Review,
  type ReviewedRow,
  rowPlace
} from "@inventory/catalog-model/Review"
import {
  decisionFromFlags,
  decisionOfRow,
  storedKeep,
  storedReplace,
  decisionToFlags,
  hasKeep,
  type SavedDecisions
} from "@inventory/catalog-contract/Decision"
import { type ColumnMatch, matchedColumn } from "@inventory/catalog-contract/Mapping"
import {
  type Field,
  fieldLabels,
  fieldWords,
  requiredFields,
  type StagedColumn,
  type StagedTable
} from "@inventory/catalog-contract/Staged"
import { costText, countText, dimensionsCellText, tagsCellText, vendorsCellText } from "./internal/itemText.ts"

/** The problem kinds in the region's shape, in the order their headings show. */
export const regionKinds: ReadonlyArray<ProblemKind> = problemKinds.map((kind) =>
  ProblemKind.make({
    id: kind.id,
    label: kind.label,
    tone: kind.tone,
    // Every kind of the import is one the person can settle on the review screen.
    fixable: true
  })
)

// Spaces round a SKU end in a different value on every row (" BLT-0042" is "BLT-0042", "XRR-0266 " is "XRR-0266"), so the
// rule's own groups would be one row each. One group per column, named by what the fix does, settles them all at once;
// each row still shows its own old and new value and is given its own.
const trimLabel = "the value without its spaces"

const toFix = (proposal: Proposal, reason: O.Option<string>): Fix =>
  Fix.make({
    reason,
    column: proposal.field,
    to: proposal.to,
    by: O.some(proposal.by),
    confidence: O.some(proposal.confidence),
    kind: proposal.kind,
    group: O.some(proposal.kind === "spaces" ? `${proposal.field}:trim` : proposal.group),
    label: proposal.kind === "spaces" ? O.some(trimLabel) : O.none(),
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
const choicesFor = (problem: Problem): O.Option<{ readonly ask: string; readonly choices: ReadonlyArray<Choice> }> => {
  if (O.isSome(problem.proposal) || problem.choices.length === 0) return O.none()
  return O.map(problem.field, (field) => ({
    ask:
      problem.kind === "changed"
        ? "Keep or replace"
        : O.match(problem.ask, {
            onNone: () => `Choose ${field === "sku" ? "sku" : fieldWords[field]}`,
            onSome: (ask) => ask
          }),
    choices: A.map(problem.choices, (value) =>
      Choice.make({
        value,
        label: O.match(R.get(storedWords, value), { onNone: () => value, onSome: (label) => label })
      })
    )
  }))
}

/**
 * A domain problem as the region shows it. Its proposal rides along as the fix; a value with no proposal that has to
 * be one of a short list is a pick between equal buttons (`choices`) instead of a box to type in.
 */
export const toRegionProblem = (problem: Problem, options: { readonly withoutRivals: boolean }): RegionProblem => {
  const pick = choicesFor(problem)
  return RegionProblem.make({
    kind: problem.kind,
    tone: O.some(problem.tone),
    reason: O.some(problem.message),
    column: problem.kind === "changed" ? O.some(storedChoice) : problem.field,
    ask: O.orElse(
      O.map(pick, (pick) => pick.ask),
      () => problem.ask
    ),
    choices: O.map(pick, (pick) => pick.choices),
    note: problem.note,
    fix: O.map(problem.proposal, (proposal) => toFix(proposal, O.none())),
    rivals: problem.rivals.length === 0 || options.withoutRivals ? O.none() : O.some(problem.rivals)
  })
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
    label: O.map(row.part, (part) => rowPlace({ rowNumber: row.rowNumber, label: O.some(part.label) }))
  }
  // Already stored: nothing to decide and nothing written; the region counts it apart under All with its tag.
  if (row.status === "already") return ReviewRow.make({ ...where, cells: row.file, stored: true })
  const decided = decisionOfRow(decisions, row.id)
  const accepted = decided.accepted
  // A lossless rule fix is always offered through `applied` (the region holds it back or puts it in force from
  // the decisions). A fix the person accepted joins them, so the region shows it in force and moves on.
  // Each carries the domain's sentence for the value it changes, so a fix held back for the person says why too.
  const applied = A.map(
    A.filter(row.proposals, (proposal) => proposal.lossless || A.contains(accepted, proposal.field)),
    (proposal) => {
      const message = A.findFirst(row.problems, (problem) => O.contains(problem.field, proposal.field))
      return toFix(
        proposal,
        O.map(message, (problem) => reasonShown(problem.message, row.reasons.length))
      )
    }
  )
  const open = A.findFirst(row.problems, (problem) => !O.exists(problem.proposal, (proposal) => proposal.lossless))
  // The region settles a row with rivals by itself once the row is kept or a rival's SKU was typed. The server is
  // stricter (only the first kept row wins, and a typed SKU can collide again), so where the two would differ the
  // problem is handed over without its rivals and stays open until the domain says it is settled.
  const stricter = O.exists(
    open,
    (open) => hasKeep(decided) || A.some(open.rivals, (id) => R.has(decisionOfRow(decisions, id).edits, "sku"))
  )
  return ReviewRow.make({
    ...where,
    cells: row.file,
    // Where the domain counts the row: Cannot import when any problem needs a typed value, however the first reads.
    blocked: row.status === "needs" ? O.some(row.outcome === "cannot") : O.none(),
    ...(applied.length === 0 ? {} : { applied }),
    problem: O.map(open, (open) => ({
      ...toRegionProblem(open, { withoutRivals: stricter }),
      reason: O.some(reasonShown(open.message, row.reasons.length))
    }))
  })
}

/**
 * The rows the person reviews: every item row of the file, the ones whose SKU is already stored as `stored` rows
 * (counted apart, nothing to decide), so the tabs add up to the file and a second load of the same file says so.
 */
export const toRegionRows = (current: Review, decisions: SavedDecisions): ReadonlyArray<ReviewRow> =>
  A.map(current.rows, (row) => toRegionRow(row, decisions))

const isStoredChoice = (value: string): value is "keep" | "replace" => value === "keep" || value === "replace"

/**
 * The region's decisions as the server takes them: the region's `ReviewDecision` as the flags the server stores, and a
 * keep-or-replace answer moved from the typed values (`edits[storedChoice]`) to `stored`, where the review reads it.
 */
export const toServerDecisions = (decisions: RegionDecisions): SavedDecisions =>
  R.map(decisions, (decision) => {
    // Decode the review library's encoded flags once, so edited fields are required from here on.
    const row = decisionFromFlags(toFlags(decision))
    return O.match(O.filter(R.get(decision.edits, storedChoice), isStoredChoice), {
      onNone: () => row,
      onSome: (answer) => ({
        ...row,
        edits: R.remove(row.edits, storedChoice),
        stored: answer === "keep" ? storedKeep : storedReplace
      })
    })
  })

/** The server's decisions as the region holds them: the inverse of `toServerDecisions`. */
export const toRegionDecisions = (decisions: SavedDecisions): RegionDecisions =>
  R.map(decisions, (decision) => {
    const { stored, ...flags } = decisionToFlags(decision)
    return fromFlags(
      DecisionFlags.make(
        stored === "undecided" ? flags : { ...flags, edits: { ...flags.edits, [storedChoice]: stored } }
      )
    )
  })

// The name and the description are sentences: they share the room and end in an ellipsis, whole on hover. Every other
// column is as wide as its longest value, measured by the region, and never cut; short of room the lowest priority
// moves into the row's detail and the SKU under the name. What is drawn for a cost, the tags, the dimensions and the
// vendors is what the Items page draws; the file's text is what the checks and the edits see.
const layout: Record<Field, Omit<Parameters<typeof ReviewColumn.make>[0], "id" | "label" | "match">> = {
  name: { display: identity, size: "fill", width: O.some(200), core: true },
  sku: { display: identity, search: true, under: true, context: true, code: true, priority: O.some(9) },
  category: { display: identity, core: true, facet: true, priority: O.some(8) },
  uom: { display: identity, core: true, facet: true, context: true, priority: O.some(8) },
  unitCost: { align: O.some("right"), core: true, priority: O.some(7), display: costText },
  // A quantity is counted in the row's own unit of measure; an empty one is imported as the default the brief gives.
  quantityOnHand: {
    align: O.some("right"),
    priority: O.some(6),
    unitFrom: O.some("uom"),
    byDefault: O.some("0"),
    display: countText
  },
  reorderPoint: { align: O.some("right"), priority: O.some(3), unitFrom: O.some("uom"), display: countText },
  isActive: { display: identity, priority: O.some(4), byDefault: O.some("true") },
  lotTracked: { display: identity, priority: O.some(2), byDefault: O.some("false") },
  tags: { priority: O.some(2), display: tagsCellText },
  firstReceivedOn: { display: identity, priority: O.some(3) },
  discontinuedOn: { display: identity, priority: O.some(4) },
  dimensions: { priority: O.some(1), display: dimensionsCellText },
  vendors: { priority: O.some(5), display: vendorsCellText },
  description: { display: identity, size: "fill", width: O.some(200), hidden: true }
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
    const text = filledAt(row, index)
    if (O.isSome(text) && !seen.includes(text.value)) seen.push(text.value)
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
  ReviewColumn.make({ display: identity, id: storedChoice, label: "Stored item", hidden: true })
]

const itemColumns = (
  mapping: ReadonlyArray<ColumnMatch>,
  unused: ReadonlyArray<StagedColumn>,
  table: StagedTable
): ReadonlyArray<ReviewColumn> =>
  order.map((field) => {
    const match = A.findFirst(mapping, (candidate) => candidate.field === field)
    const column = O.flatMap(match, matchedColumn)
    const missing = O.isSome(match) && O.isNone(column) && A.contains(requiredFields, field) && unused.length > 0
    return ReviewColumn.make({
      id: field,
      label: fieldLabels[field],
      ...layout[field],
      match: O.orElse(
        O.map(column, (column) =>
          RegionColumnMatch.cases.matched.make({
            source: column.header,
            by: "name",
            samples: column.examples
          })
        ),
        () =>
          missing
            ? RegionColumnMatch.cases.unmatched.makeOption({
                candidates: unused.map((column) => ({ source: column.label, samples: samplesOf(table, column.index) }))
              })
            : O.none()
      )
    })
  })
