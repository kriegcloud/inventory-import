// Which decisions a re-match of a column takes back (Benjamin, 2026-11-20: "Server refuses, says so" for an accept, an
// undone fix, and for a SKU re-match a Replace, a Keep-stored and a keep-one-of-two; "Refuse if it changes the row" for
// a Replace or a Keep-stored across a re-match of another column). The one thing not to break: the match, the save and
// the confirm judge every decision by these functions, so a decision a match dropped is never applied by a save or a
// confirm that was on its way, and the two stores agree.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { RowId } from "@inventory/catalog-contract/Ids"
import { type MatchTakeBack, takenBackRowsNamed } from "@inventory/catalog-contract/Import"
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
  storedUndecided,
  type TakenBackKind
} from "@inventory/catalog-contract/Decision"
import { type ItemFields, skuKey } from "@inventory/catalog-contract/Item"
import type { Suggestion } from "@inventory/catalog-contract/Suggestion"
import { matchColumns } from "../Review/Mapping.rules.ts"
import {
  carryDecisions,
  type ItemsOfRow,
  readsAsItem,
  review,
  ruleFixes,
  type StoredDifference
} from "../Review/Review.rules.ts"

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

// How a row compares with its stored item, as the review draws it: whether it reads as an item at all, and where it
// differs. A row that does not read is not compared, so "no difference" alone cannot tell it from a row that agrees.
type RowComparison = { readonly reads: boolean; readonly stored: ReadonlyArray<StoredDifference> }

const sameDifferences = (a: ReadonlyArray<StoredDifference>, b: ReadonlyArray<StoredDifference>): boolean =>
  a.length === b.length &&
  A.every(a, (one) =>
    A.some(b, (other) => other.field === one.field && other.stored === one.stored && other.file === one.file)
  )

const sameComparison = (a: O.Option<RowComparison>, b: O.Option<RowComparison>): boolean =>
  O.isNone(a)
    ? O.isNone(b)
    : O.isSome(b) && a.value.reads === b.value.reads && sameDifferences(a.value.stored, b.value.stored)

// The decision as the row read before `field` was matched again, for that field only: what the re-match of another
// field takes back in any case is left out on both sides, so a change is told against this field alone.
const beforeOnly = (question: ComparisonQuestion): RowDecision => ({
  ...question.now,
  accepted: A.filter(
    question.then.accepted,
    (field) => field === question.field || A.contains(question.now.accepted, field)
  ),
  reverted: A.filter(
    question.then.reverted,
    (field) => field === question.field || A.contains(question.now.reverted, field)
  )
})

/**
 * Of the questions, the rows whose comparison with their stored item changed because the field was matched again:
 * the whole row's comparison (whether it reads as an item, and every difference with its stored text and file text)
 * under the column the field read on the row's revision is not the one under the column it reads now. A row that read
 * on one side and not on the other changed, whatever its differences said. A field that reads the same column again
 * changed nothing; a column not known (`columnAt` none) counts as changed. Each side is the review the screen would
 * draw: the row's decision as made under the column then, as it now reads under the column now, every other field on
 * its column now.
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
  const comparisonOf = (choices: ReadonlyArray<MappingChoice>, decisions: SavedDecisions) => {
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
    return (rowId: string): O.Option<RowComparison> =>
      O.map(R.get(byId, rowId), (row) => ({ reads: readsAsItem(row.values), stored: row.stored }))
  }
  const nowComparison = comparisonOf(
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
    const thenComparison = comparisonOf(
      pinned,
      R.fromEntries(A.map(group, ({ question }) => [question.rowId, beforeOnly(question)] as const))
    )
    return A.filter(
      A.map(group, ({ question }) => question),
      (question) => !sameComparison(thenComparison(question.rowId), nowComparison(question.rowId))
    )
  })
  return A.map([...unknown, ...changed], ({ rowId, field }) => ({ rowId, field }))
}

/**
 * The stored items a question to the file's review was answered from (a match's, a save's or a confirm's judgement of
 * a Replace or Keep-stored across a re-match): every SKU key it looked up, and the items it found under them, each at
 * its revision. Both stores write the match, the save and the confirm only while the organization's items under those
 * keys are still exactly these, so an item edited, replaced, created or taken back in between makes the judgement be
 * worked out again, never written with take-backs judged against an item that is no longer there. No keys: the review
 * was not asked, and nothing is checked.
 */
export const ItemsAsRead = S.Struct({
  keys: S.Array(S.String).annotateKey({ description: "Every SKU key the review looked up, as `skuKey` makes them" }),
  items: S.Array(
    S.Struct({ id: S.String, revision: S.Int }).annotate({
      description: "One stored item the review compared with, at the revision it read"
    })
  ).annotateKey({ description: "Every item the organization had under those keys when the review read them" })
}).annotate({
  identifier: "ItemsAsRead",
  description: "The stored items a judgement of the decisions across a re-match was worked out from"
})
/** The decoded value of `ItemsAsRead`. */
export type ItemsAsRead = typeof ItemsAsRead.Type

/** A judgement that did not ask the file's review: it read no stored item, so no item change can overtake it. */
export const noItemsRead: ItemsAsRead = { keys: [], items: [] }

/**
 * Whether the organization's items (`items`, every one it has) are still those a judgement read: under its keys
 * exactly the items it found, each at the revision it found. The in-memory store's form of the check the D1 store makes
 * in its write; true when nothing was read.
 *
 * @example stillAsRead({ keys: ["AAA-0002"], items: [{ id: "item-1", revision: 1 }] })(itemsNow) // false once edited
 */
export const stillAsRead =
  (read: ItemsAsRead) =>
  (items: ReadonlyArray<{ readonly id: string; readonly sku: string; readonly revision: number }>): boolean => {
    if (read.keys.length === 0) return true
    const keys = HashSet.fromIterable(read.keys)
    const under = A.filter(items, (item) => HashSet.has(keys, skuKey(item)))
    return (
      under.length === read.items.length &&
      A.every(read.items, (seen) => A.some(under, (item) => item.id === seen.id && item.revision === seen.revision))
    )
  }

/** The review's answer to a match's question, and the stored items it was worked out from. */
export type Compared = { readonly changed: ReadonlyArray<ComparisonChanged>; readonly read: ItemsAsRead }

/**
 * What a match asks the file's review, about the stored decisions it read: of the Replaces and Keep-storeds whose row
 * may compare otherwise with its stored item now that a field other than the SKU reads another column, the ones whose
 * comparison did change (`comparisonsChanged`), and the stored items the answer rests on. The store asks it inside its
 * write, of the choices and moves the match leaves, so the answer is about the decisions the match writes over.
 */
export type CompareAtMatch = (asked: {
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly questions: ReadonlyArray<ComparisonQuestion>
}) => Effect.Effect<Compared>

/** A match that does not have the file's review at hand: no Replace is taken back for a column other than the SKU. */
export const noComparison: CompareAtMatch = () => Effect.succeed({ changed: [], read: { keys: [], items: [] } })

// A row id's place in the file: its row's number, then its part. A key that is not a row id goes last.
const placeInFile = (rowId: string): readonly [number, number] => {
  const found = /^row-(\d+)(?:\.(\d+))?$/.exec(rowId)
  return found === null ? [Number.MAX_SAFE_INTEGER, 0] : [Number(found[1] ?? "0"), Number(found[2] ?? "0")]
}
const fileOrder: Order.Order<string> = Order.mapInput(Order.Tuple([Order.Number, Order.Number]), placeInFile)
const kindOrder: ReadonlyArray<TakenBackKind> = ["accept", "stored", "twin", "undo"]
const indexIn = <A>(list: ReadonlyArray<A>, value: A): number =>
  O.getOrElse(
    A.findFirstIndex(list, (candidate) => candidate === value),
    () => list.length
  )

/**
 * What one match took back, as the view names it: one entry per re-matched field and kind (fields in the item's
 * order, kinds as the screen names them), each with the revision the match wrote, who matched, how many rows and the
 * first `takenBackRowsNamed` of them in the file's order. A taken-back key that is not a row id is not counted, and a
 * field and kind left with no row has no entry.
 *
 * @example
 * takenBackOfMatch({ revision: 13, by: "Dana Whitfield", notApplied: [{ rowId: "row-9", field: "sku", kind: "stored" }, { rowId: "row-4", field: "sku", kind: "stored" }] })
 * // [{ revision: 13, by: "Dana Whitfield", field: "sku", kind: "stored", count: 2, rows: ["row-4", "row-9"] }]
 */
export const takenBackOfMatch = (input: {
  readonly revision: number
  readonly by: string
  readonly notApplied: ReadonlyArray<StaleAccept>
}): ReadonlyArray<MatchTakeBack> => {
  const isRowId = S.is(RowId)
  const groups = A.groupBy(input.notApplied, (taken) => `${taken.kind}:${taken.field}`)
  const entries = A.getSomes(
    A.map(R.values(groups), (group) => {
      const first = A.headNonEmpty(group)
      // Only rows the entry can name are counted, so `count` and `rows` always agree; a stored key that names no row
      // of a file is no row the screen can show.
      const rows = A.dedupe(
        A.filter(
          A.map(group, (taken) => taken.rowId),
          isRowId
        )
      )
      return O.flatMap(
        A.findFirst(fields, (known) => known === first.field),
        (field): O.Option<MatchTakeBack> =>
          rows.length === 0
            ? O.none()
            : O.some({
                revision: input.revision,
                by: input.by,
                field,
                kind: first.kind,
                count: rows.length,
                rows: A.take(A.sort(rows, fileOrder), takenBackRowsNamed)
              })
      )
    })
  )
  return A.sort(
    entries,
    Order.mapInput(
      Order.Tuple([Order.Number, Order.Number]),
      (entry: MatchTakeBack) => [indexIn(fields, entry.field), indexIn(kindOrder, entry.kind)] as const
    )
  )
}

const kindWords: Readonly<Record<TakenBackKind, readonly [string, string]>> = {
  accept: ["accepted proposal", "accepted proposals"],
  stored: ["Replace or Keep-stored", "Replaces or Keep-storeds"],
  twin: ["keep of one of two", "keeps of one of two"],
  undo: ["undone fix", "undone fixes"]
}

/**
 * The words a match's audit line adds for what it took back: the rows counted by kind, over every field it moved;
 * empty when it took nothing back.
 *
 * @example takenBackWords(takeBacks) // "; took back 2 Replaces or Keep-storeds, 1 keep of one of two"
 */
export const takenBackWords = (takeBacks: ReadonlyArray<MatchTakeBack>): string => {
  const counted = A.getSomes(
    A.map(kindOrder, (kind) => {
      const count = A.reduce(
        A.filter(takeBacks, (entry) => entry.kind === kind),
        0,
        (total, entry) => total + entry.count
      )
      const [one, many] = kindWords[kind]
      return count === 0 ? O.none<string>() : O.some(`${count} ${count === 1 ? one : many}`)
    })
  )
  return counted.length === 0 ? "" : `; took back ${A.join(counted, ", ")}`
}

/**
 * What a draft keeps of its matches' take-backs once one more match is written: every entry it had, then this
 * match's. None is let go while the import is open: a screen still holding the picture of an earlier revision is told
 * by that entry, however many matches came after it (the confirm lets them all go). It stays small without a cap: one
 * entry per match, field and kind, each naming at most `takenBackRowsNamed` rows.
 *
 * @example withTakeBacks({ kept: draftsEntries, added: takenBackOfMatch({ revision: 13, by, notApplied }) })
 */
export const withTakeBacks = (input: {
  readonly kept: ReadonlyArray<MatchTakeBack>
  readonly added: ReadonlyArray<MatchTakeBack>
}): ReadonlyArray<MatchTakeBack> => [...input.kept, ...input.added]

/**
 * One match worked out from a draft as it is stored: the choices it leaves (the field's new choice stamped `at`, the
 * revision the match moves the draft to), the moves it adds, and the stored decisions it takes back, each judged as
 * made on the revision before the match: the rows whose decision changes (`rewrites`), and what was taken back by row,
 * field and kind (`notApplied`). `read` is the stored items the file's review answered from, when it was asked. Both
 * stores write exactly this, in one atomic write.
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
  const compared: O.Option<Compared> =
    questions.length === 0 ? O.none() : yield* Effect.asSome(input.compare({ choices, moves, questions }))
  const changed = O.match(compared, { onNone: () => [], onSome: (answer) => answer.changed })
  const { applied, notApplied } = withoutStaleDecisions({ choices, moves, madeOn, set: input.decisions, changed })
  const same = S.toEquivalence(RowDecision)
  const rewrites = R.filter(applied, (decision, rowId) =>
    O.match(R.get(input.decisions, rowId), { onNone: () => true, onSome: (old) => !same(old, decision) })
  )
  return { at, choices, moves, rewrites, notApplied, read: O.map(compared, (answer) => answer.read) }
})
