// Which decisions a re-match of a column takes back (Benjamin, 2026-11-20: "Server refuses, says so" for an accept, an
// undone fix, and for a SKU re-match a Replace, a Keep-stored and a keep-one-of-two; "Refuse if it changes the row" for
// a Replace or a Keep-stored across a re-match of another column). The one thing not to break: the match, the save and
// the confirm judge every decision by these functions, so a decision a match dropped is never applied by a save or a
// confirm that was on its way, and the two stores agree.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { type Field, fields, type StagedHead, type StagedTable } from "@inventory/catalog-contract/Staged"
import { type ColumnMove, type MappingChoice, matchedColumn } from "@inventory/catalog-contract/Mapping"
import {
  hasKeep,
  isLeftOut,
  placeLeftOut,
  placeOpen,
  RowDecision,
  type SavedDecisions,
  type StaleAccept,
  storedUndecided
} from "@inventory/catalog-contract/Decision"
import type { ItemFields } from "@inventory/catalog-contract/Item"
import type { Suggestion } from "@inventory/catalog-contract/Suggestion"
import { matchColumns } from "../Review/Mapping.rules.ts"
import { carryDecisions, type ItemsOfRow, review, ruleFixes, type StoredDifference } from "../Review/Review.rules.ts"

/**
 * The column each field reads under these choices, by a person's choice or else by its heading; null for none. Only
 * the headings are read, so a file of 50,000 rows costs what a file of one does.
 *
 * @example columnsOf({ head, choices: [] })("unitCost") // 5, the column headed "unit_cost"
 */
export const columnsOf = (input: {
  readonly head: StagedHead
  readonly choices: ReadonlyArray<MappingChoice>
}): ((field: Field) => number | null) => {
  const mapping = matchColumns({ table: { ...input.head, rows: [] }, choices: input.choices })
  return (field) =>
    O.getOrNull(
      O.map(
        O.flatMap(
          A.findFirst(mapping, (match) => match.field === field),
          matchedColumn
        ),
        (column) => column.index
      )
    )
}

/**
 * What one match writes into the draft's moves: the field matched by hand, always (its choice is new, whatever column
 * it read before), and every other field the match moved off its column, each stamped with the revision the match
 * moves the draft to. A field read by its heading moves when a person gives its column to another field.
 *
 * @example
 * // A person gives column 5 (headed "unit_cost") to Quantity: Quantity moves, and so does Unit cost, to no column.
 * movesOfMatch({ head, before: [], after: [{ field: "quantityOnHand", column: 5, by: "person", at: 13 }], field: "quantityOnHand", at: 13 })
 * // [{ field: "unitCost", at: 13, was: 5, column: null }, { field: "quantityOnHand", at: 13, was: 6, column: 5 }]
 */
export const movesOfMatch = (input: {
  readonly head: StagedHead
  readonly before: ReadonlyArray<MappingChoice>
  readonly after: ReadonlyArray<MappingChoice>
  readonly field: Field
  readonly at: number
}): ReadonlyArray<ColumnMove> => {
  const was = columnsOf({ head: input.head, choices: input.before })
  const now = columnsOf({ head: input.head, choices: input.after })
  return A.map(
    A.filter(fields, (field) => field === input.field || was(field) !== now(field)),
    (field): ColumnMove => ({ field, at: input.at, was: was(field), column: now(field) })
  )
}

/**
 * Whether a field's column was matched again after revision `made`: by a choice stamped later, or by a later move
 * (the field matched by hand, or moved off its column by another field's match).
 */
export const matchedAfter =
  (input: { readonly choices: ReadonlyArray<MappingChoice>; readonly moves: ReadonlyArray<ColumnMove> }) =>
  (made: number) =>
  (field: string): boolean =>
    A.some(input.choices, (choice) => choice.field === field && choice.at > made) ||
    A.some(input.moves, (move) => move.field === field && move.at > made)

/**
 * The column a field read at revision `made`: the `was` of the field's first move after it, or the column it reads
 * now when it has not moved since. None when a choice after `made` has no move kept for it (a draft matched before
 * moves were kept): that column is not known, and a decision resting on it is taken back.
 *
 * @example
 * // Unit cost read 5, was matched to 7 at revision 12 and to 9 at 15: on revision 11 it read 5, on 13 it read 7.
 * columnAt({ choices, moves, now })("unitCost", 11) // O.some(5)
 */
export const columnAt =
  (input: {
    readonly choices: ReadonlyArray<MappingChoice>
    readonly moves: ReadonlyArray<ColumnMove>
    readonly now: (field: Field) => number | null
  }) =>
  (field: Field, made: number): O.Option<number | null> => {
    const later = A.filter(input.moves, (move) => move.field === field && move.at > made)
    const first = A.reduce(later, O.none<ColumnMove>(), (found, move) =>
      O.isSome(found) && found.value.at <= move.at ? found : O.some(move)
    )
    if (O.isSome(first)) return O.some(first.value.was)
    return A.some(input.choices, (choice) => choice.field === field && choice.at > made)
      ? O.none()
      : O.some(input.now(field))
  }

/**
 * A Replace or a Keep-stored made on revision `made`, on a row whose comparison with its stored item may have changed
 * because `field` (not the SKU) was matched again since. `then` is the decision as the person made it; `now` is the
 * same decision with the parts the re-match takes back in any case (accepts and undone fixes of a field matched again)
 * already taken out: what the row reads as now.
 */
export type ComparisonQuestion = {
  readonly rowId: string
  readonly field: Field
  readonly made: number
  readonly then: RowDecision
  readonly now: RowDecision
}

/** A row and the field whose re-match changed how the row compares with its stored item. */
export type ComparisonChanged = { readonly rowId: string; readonly field: Field }

const otherFields = A.filter(fields, (field) => field !== "sku")

// One row judged: what of its decision stands, and what was taken back, in the order the screen names them.
const judgeRow = (input: {
  readonly rowId: string
  readonly decision: RowDecision
  readonly stale: (field: string) => boolean
  readonly changed: (field: Field) => boolean
}): { readonly decision: RowDecision; readonly taken: ReadonlyArray<StaleAccept> } => {
  const { rowId, decision, stale } = input
  const skuMoved = stale("sku")
  const storedBy: O.Option<Field> =
    decision.stored.kind === "undecided"
      ? O.none()
      : skuMoved
        ? O.some("sku")
        : A.findFirst(otherFields, (field) => stale(field) && input.changed(field))
  const twin = skuMoved && hasKeep(decision)
  const taken: ReadonlyArray<StaleAccept> = [
    ...A.map(A.filter(decision.accepted, stale), (field) => ({ rowId, field, kind: "accept" as const })),
    ...A.map(A.filter(decision.reverted, stale), (field) => ({ rowId, field, kind: "undo" as const })),
    ...O.match(storedBy, {
      onNone: () => [],
      onSome: (field) => [{ rowId, field, kind: "stored" as const }]
    }),
    ...(twin ? [{ rowId, field: "sku", kind: "twin" as const }] : [])
  ]
  return {
    decision: {
      ...decision,
      accepted: A.filter(decision.accepted, (field) => !stale(field)),
      reverted: A.filter(decision.reverted, (field) => !stale(field)),
      stored: O.isSome(storedBy) ? storedUndecided : decision.stored,
      place: twin ? (isLeftOut(decision) ? placeLeftOut(false) : placeOpen) : decision.place
    },
    taken
  }
}

/**
 * The Replaces and Keep-storeds among these decisions whose row may compare otherwise with its stored item because a
 * field other than the SKU was matched again after the row's revision (`madeOn`, 0 when the request names none). Only
 * these need the file's review to settle; a SKU matched again takes every one back without it.
 */
export const comparisonQuestions = (input: {
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly madeOn: Readonly<Record<string, number>>
  readonly set: SavedDecisions
}): ReadonlyArray<ComparisonQuestion> =>
  A.flatMap(R.toEntries(input.set), ([rowId, decision]) => {
    const made = O.getOrElse(R.get(input.madeOn, rowId), () => 0)
    const stale = matchedAfter(input)(made)
    if (decision.stored.kind === "undecided" || stale("sku")) return []
    const now = judgeRow({ rowId, decision, stale, changed: () => false }).decision
    return A.map(
      A.filter(otherFields, (field) => stale(field)),
      (field): ComparisonQuestion => ({ rowId, field, made, then: decision, now })
    )
  })

/**
 * Decisions as they may be applied, each row judged on the revision it was made on (`madeOn`; 0 when the request
 * names none), and what was taken back, named with its kind and the field whose column was matched again:
 *
 * - an accept or an undone fix of a field matched again after the row's revision ("accept", "undo");
 * - a Replace or a Keep-stored made before the SKU was matched again ("stored", field "sku"): the row's stored choice
 *   is undecided again;
 * - a keep-one-of-two made before the SKU was matched again ("twin", field "sku"): the row's place is open again, and
 *   a row left out stays left out;
 * - a Replace or a Keep-stored made before another field was matched again, only on a row in `changed` for that field
 *   ("stored", that field); a Replace on a row whose comparison did not change stands.
 *
 * @example
 * // Unit cost matched again at 12 (a move kept); row 55 accepted it and replaced its stored item on 11, and the cost
 * // it reads now differs from the stored item's where the old column did not.
 * withoutStaleDecisions({ choices, moves, madeOn: { "row-55": 11 }, set, changed: [{ rowId: "row-55", field: "unitCost" }] })
 * // notApplied: [{ rowId: "row-55", field: "unitCost", kind: "accept" }, { rowId: "row-55", field: "unitCost", kind: "stored" }]
 */
export const withoutStaleDecisions = (input: {
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly madeOn: Readonly<Record<string, number>>
  readonly set: SavedDecisions
  readonly changed: ReadonlyArray<ComparisonChanged>
}): { readonly applied: SavedDecisions; readonly notApplied: ReadonlyArray<StaleAccept> } => {
  const judged = R.map(input.set, (decision, rowId) =>
    judgeRow({
      rowId,
      decision,
      stale: matchedAfter(input)(O.getOrElse(R.get(input.madeOn, rowId), () => 0)),
      changed: (field) => A.some(input.changed, (row) => row.rowId === rowId && row.field === field)
    })
  )
  return {
    applied: R.map(judged, (row) => row.decision),
    notApplied: A.flatMap(R.values(judged), (row) => row.taken)
  }
}

const sameDifference = (a: O.Option<StoredDifference>, b: O.Option<StoredDifference>): boolean =>
  O.isNone(a) ? O.isNone(b) : O.isSome(b) && a.value.stored === b.value.stored && a.value.file === b.value.file

/**
 * Of the questions, the rows whose comparison with their stored item changed because the field was matched again:
 * the difference for that field (stored text and file text, or none) under the column the field read on the row's
 * revision is not the one under the column it reads now. A field that reads the same column again changed nothing;
 * a column not known (`columnAt` none) counts as changed. Each side is the review the screen would draw: the row's
 * decision as made under the column then, as it now reads under the column now, every other field on its column now.
 */
export const comparisonsChanged = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly storedItems: ReadonlyArray<ItemFields>
  readonly createdIds: ReadonlyArray<string>
  readonly suggestions: ReadonlyArray<Suggestion>
  readonly itemsOf: ItemsOfRow
  readonly questions: ReadonlyArray<ComparisonQuestion>
}): ReadonlyArray<ComparisonChanged> => {
  const now = columnsOf({ head: input.table, choices: input.choices })
  const then = columnAt({ choices: input.choices, moves: input.moves, now })
  const read = A.map(input.questions, (question) => ({ question, was: then(question.field, question.made) }))
  const moved = A.filter(read, ({ question, was }) =>
    O.match(was, { onNone: () => true, onSome: (column) => column !== now(question.field) })
  )
  const unknown = A.map(
    A.filter(moved, ({ was }) => O.isNone(was)),
    ({ question }) => question
  )
  const known = A.filter(moved, ({ was }) => O.isSome(was))
  if (known.length === 0) return A.map(unknown, ({ rowId, field }) => ({ rowId, field }))
  const differenceOf = (choices: ReadonlyArray<MappingChoice>, decisions: SavedDecisions) => {
    const reviewed = review({
      table: input.table,
      choices,
      decisions: carryDecisions({ table: input.table, choices, decisions, mode: ruleFixes, itemsOf: input.itemsOf }),
      storedItems: input.storedItems,
      createdIds: input.createdIds,
      itemsOf: input.itemsOf,
      suggestions: input.suggestions
    })
    // Keyed by plain text: a question names its row as the request did.
    const byId: Readonly<Record<string, (typeof reviewed.rows)[number]>> = R.fromEntries(
      A.map(reviewed.rows, (row) => [row.id, row] as const)
    )
    return (rowId: string, field: Field): O.Option<StoredDifference> =>
      O.flatMap(R.get(byId, rowId), (row) => A.findFirst(row.stored, (difference) => difference.field === field))
  }
  const nowDifference = differenceOf(
    input.choices,
    R.fromEntries(A.map(known, ({ question }) => [question.rowId, question.now] as const))
  )
  // One review per field and the column it read then, with every other field on the column it reads now.
  const groups = A.groupBy(known, ({ question, was }) => `${question.field}:${String(O.getOrNull(was))}`)
  const changed = A.flatMap(R.values(groups), (group) => {
    const first = A.headNonEmpty(group)
    const pinned = A.map(fields, (field): MappingChoice => ({
      field,
      column: field === first.question.field ? O.getOrNull(first.was) : now(field),
      by: "person",
      at: 0
    }))
    const thenDifference = differenceOf(
      pinned,
      R.fromEntries(A.map(group, ({ question }) => [question.rowId, question.then] as const))
    )
    return A.filter(
      A.map(group, ({ question }) => question),
      (question) =>
        !sameDifference(thenDifference(question.rowId, question.field), nowDifference(question.rowId, question.field))
    )
  })
  return A.map([...unknown, ...changed], ({ rowId, field }) => ({ rowId, field }))
}

/**
 * What a match asks the file's review, about the stored decisions it read: of the Replaces and Keep-storeds whose row
 * may compare otherwise with its stored item now that a field other than the SKU reads another column, the ones whose
 * comparison did change (`comparisonsChanged`). The store asks it inside its write, of the choices and moves the match
 * leaves, so the answer is about the decisions the match writes over.
 */
export type CompareAtMatch = (asked: {
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly questions: ReadonlyArray<ComparisonQuestion>
}) => Effect.Effect<ReadonlyArray<ComparisonChanged>>

/** A match that does not have the file's review at hand: no Replace is taken back for a column other than the SKU. */
export const noComparison: CompareAtMatch = () => Effect.succeed([])

/**
 * One match worked out from a draft as it is stored: the choices it leaves (the field's new choice stamped `at`, the
 * revision the match moves the draft to), the moves it adds, and the stored decisions it takes back, each judged as
 * made on the revision before the match. Only the rows whose decision changes are in `rewrites`. Both stores write
 * exactly this, in one atomic write.
 */
export const planMatch = Effect.fnUntraced(function* (input: {
  readonly head: StagedHead
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly decisions: SavedDecisions
  readonly choice: { readonly field: Field; readonly column: number | null }
  readonly revision: number
  readonly compare: CompareAtMatch
}) {
  const at = input.revision + 1
  const choices: ReadonlyArray<MappingChoice> = [
    ...A.filter(input.choices, (old) => old.field !== input.choice.field),
    { field: input.choice.field, column: input.choice.column, by: "person", at }
  ]
  const moves = [
    ...input.moves,
    ...movesOfMatch({ head: input.head, before: input.choices, after: choices, field: input.choice.field, at })
  ]
  const madeOn = R.map(input.decisions, () => input.revision)
  const questions = comparisonQuestions({ choices, moves, madeOn, set: input.decisions })
  const changed = questions.length === 0 ? [] : yield* input.compare({ choices, moves, questions })
  const { applied } = withoutStaleDecisions({ choices, moves, madeOn, set: input.decisions, changed })
  const same = S.toEquivalence(RowDecision)
  const rewrites = R.filter(applied, (decision, rowId) =>
    O.match(R.get(input.decisions, rowId), { onNone: () => true, onSome: (old) => !same(old, decision) })
  )
  return { at, choices, moves, rewrites }
})
