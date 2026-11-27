// Which decisions a re-match of a column takes back (Benjamin, 2026-11-20: "Server refuses, says so" for an accept, an
// undone fix, and for a SKU re-match a Replace, a Keep-stored and a keep-one-of-two; "Refuse if it changes the row" for
// a Replace or a Keep-stored across a re-match of another column). The one thing not to break: the match, the save and
// the confirm judge every decision by these functions, so a decision a match dropped is never applied by a save or a
// confirm that was on its way, and the two stores agree.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { dual, identity } from "effect/Function"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as Struct from "effect/Struct"
import { ItemId, RowId, SuggestionId } from "@inventory/catalog-contract/Ids"
import { type MatchTakeBack, takenBackRowsNamed } from "@inventory/catalog-contract/Import"
import { type Field, fields, type StagedHead, type StagedTable } from "@inventory/catalog-contract/Staged"
import { ColumnMove, MappingChoice, matchedColumn } from "@inventory/catalog-contract/Mapping"
import {
  hasKeep,
  isLeftOut,
  placeLeftOut,
  placeOpen,
  RowDecision,
  type SavedDecisions,
  type StaleAccept,
  StoredChoice,
  storedUndecided,
  TakenBackKind
} from "@inventory/catalog-contract/Decision"
import { type ItemFields } from "@inventory/catalog-contract/Item"
import { skuKey } from "@inventory/catalog-contract/SkuKey"
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
 * The column each field reads under these choices, by a person's choice or else by its heading; none for none. Only
 * the headings are read, so a file of 50,000 rows costs what a file of one does.
 *
 * @example columnsOf({ head, choices: [] })("unitCost") // O.some(5), the column headed "unit_cost"
 */
export const columnsOf = (input: {
  readonly head: StagedHead
  readonly choices: ReadonlyArray<MappingChoice>
}): ((field: Field) => O.Option<number>) => {
  const mapping = matchColumns({ table: { ...input.head, rows: [] }, choices: input.choices })
  return (field) =>
    O.map(
      O.flatMap(
        A.findFirst(mapping, (match) => match.field === field),
        matchedColumn
      ),
      (column) => column.index
    )
}

/** Whether two fields' columns, or two readings of one, are the same: the same column, or both none. */
export const sameColumn: {
  (that: O.Option<number>): (self: O.Option<number>) => boolean
  (self: O.Option<number>, that: O.Option<number>): boolean
} = dual(
  2,
  O.makeEquivalence((a: number, b: number) => a === b)
)

// The revision a field's choice was made on when the match kept no move for it (a draft matched before moves were
// kept): the column the field read before that revision is not known. None when it is.
const matchedUnkept =
  (input: { readonly choices: ReadonlyArray<MappingChoice>; readonly moves: ReadonlyArray<ColumnMove> }) =>
    (field: Field): O.Option<number> =>
      O.map(
        A.findFirst(
          input.choices,
          (choice) =>
            choice.field === field &&
            choice.at > 0 &&
            !A.some(input.moves, (move) => move.field === field && move.at >= choice.at)
        ),
        (choice) => choice.at
      )

/**
 * What one match writes into the draft's moves: every field that reads another column after it than before, each
 * stamped with the revision the match moves the draft to. The field matched by hand is one of them only when its column
 * changed: a person picking the column it already reads moves nothing (Benjamin, 2026-11-21, "Only when it changes").
 * A field read by its heading moves when a person gives its column to another field. `kept` is the draft's moves before
 * this match: a field matched before moves were kept says from which revision its `was` is known.
 *
 * @example
 * // A person gives column 5 (headed "unit_cost") to Quantity: Quantity moves, and so does Unit cost, to no column.
 * movesOfMatch({ head, before: [], after: [{ field: "quantityOnHand", column: O.some(5), by: "person", at: 13 }], kept: [], at: 13 })
 * // [{ field: "unitCost", at: 13, was: O.some(5), column: O.none(), knownFrom: O.none() }, { field: "quantityOnHand", at: 13, was: O.some(6), column: O.some(5), knownFrom: O.none() }]
 */
export const movesOfMatch = (input: {
  readonly head: StagedHead
  readonly before: ReadonlyArray<MappingChoice>
  readonly after: ReadonlyArray<MappingChoice>
  readonly kept: ReadonlyArray<ColumnMove>
  readonly at: number
}): ReadonlyArray<ColumnMove> => {
  const was = columnsOf({ head: input.head, choices: input.before })
  const now = columnsOf({ head: input.head, choices: input.after })
  const unkept = matchedUnkept({ choices: input.before, moves: input.kept })
  return A.map(
    A.filter(fields, (field) => !sameColumn(was(field), now(field))),
    (field): ColumnMove => ({ field, at: input.at, was: was(field), column: now(field), knownFrom: unkept(field) })
  )
}

/** Revision 0: the import as it was staged, before anybody acted on it. */
export const stagedRevision = 0

/**
 * The revision a row was decided on, as a save or a confirm names it in `madeOn`. A row it leaves out counts as made
 * on revision 0, the import as staged: `SaveRequest.madeOn` says so to every client.
 *
 * @example madeOnOf({ "row-12": 7 }, "row-12") // 7
 * madeOnOf({ "row-12": 7 }, "row-3") // 0
 */
export const madeOnOf: {
  (rowId: string): (madeOn: Readonly<Record<string, number>>) => number
  (madeOn: Readonly<Record<string, number>>, rowId: string): number
} = dual(2, (madeOn: Readonly<Record<string, number>>, rowId: string): number =>
  O.match(R.get(madeOn, rowId), { onNone: () => stagedRevision, onSome: identity })
)

/**
 * The revision a stored decision was saved at, from what the store keeps (`savedAt`). A decision stored before that was
 * kept reads as saved at revision 0, the import as staged: before any save. No decision of Benjamin's backs this; it is
 * what the code did, and is listed in the goal's "Defaults nobody decided".
 */
export const savedAtOf: {
  (rowId: string): (savedAt: Readonly<Record<string, number>>) => number
  (savedAt: Readonly<Record<string, number>>, rowId: string): number
} = dual(2, (savedAt: Readonly<Record<string, number>>, rowId: string): number =>
  O.match(R.get(savedAt, rowId), { onNone: () => stagedRevision, onSome: identity })
)

/**
 * Whether a field began to read another column after revision `made`: by a choice stamped later, or by a later move
 * (the field matched by hand, or moved off its column by another field's match). A choice of the column the field read
 * already moves nothing and keeps the stamp it had (`planMatch`), so it is not one.
 */
export const matchedAfter =
  (input: { readonly choices: ReadonlyArray<MappingChoice>; readonly moves: ReadonlyArray<ColumnMove> }) =>
    (made: number) =>
      (field: string): boolean =>
        A.some(input.choices, (choice) => choice.field === field && choice.at > made) ||
        A.some(input.moves, (move) => move.field === field && move.at > made)

/**
 * The column a field read at revision `made`: the `was` of the field's first move after it, or the column it reads
 * now when it has not moved since. None when a match after `made` kept no move for it (a draft matched before moves
 * were kept: its choice stands alone, or the first move after it says its `was` is known only from a later revision):
 * that column is not known, and a decision resting on it is taken back (Benjamin, 2026-11-21, "Take it back, say so").
 *
 * @example
 * // Unit cost read 5, was matched to 7 at revision 12 and to 9 at 15: on revision 11 it read 5, on 13 it read 7.
 * columnAt({ choices, moves, now })("unitCost", 11) // O.some(5)
 */
export const columnAt =
  (input: {
    readonly choices: ReadonlyArray<MappingChoice>
    readonly moves: ReadonlyArray<ColumnMove>
    readonly now: (field: Field) => O.Option<number>
  }) =>
    (field: Field, made: number): O.Option<O.Option<number>> => {
      const later = A.filter(input.moves, (move) => move.field === field && move.at > made)
      const first = A.reduce(later, O.none<ColumnMove>(), (found, move) =>
        O.isSome(found) && found.value.at <= move.at ? found : O.some(move)
      )
      if (O.isSome(first)) {
        return O.exists(first.value.knownFrom, (from) => made < from) ? O.none() : O.some(first.value.was)
      }
      return A.some(input.choices, (choice) => choice.field === field && choice.at > made)
        ? O.none()
        : O.some(input.now(field))
    }

/**
 * A Replace or a Keep-stored on a row whose comparison with its stored item may have changed because other fields than
 * the SKU (`fields`, in the item's order) were matched again since it was made. Each names the revision its column is
 * looked up on: the one the decision was made on, or one before it when the column the field read is not known.
 * `decided` tells one making of the decision from another: the revision a request names for the row (the same on every
 * try of it), or for a stored decision the revision it was saved at. `then` is the decision as the person made it;
 * `now` is the same decision with the parts the re-match takes back in any case (accepts and undone fixes of a field
 * matched again) already taken out: what the row reads as now.
 */
export type ComparisonQuestion = {
  readonly rowId: string
  readonly fields: ReadonlyArray<{ readonly field: Field; readonly made: number }>
  readonly decided: number
  readonly then: RowDecision
  readonly now: RowDecision
}

/** A row whose comparison with its stored item a re-match changed, and the field it is named by. */
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
  const storedBy: O.Option<Field> = StoredChoice.guards.undecided(decision.stored)
    ? O.none()
    : skuMoved
      ? O.some("sku")
      : A.findFirst(otherFields, (field) => stale(field) && input.changed(field))
  const twin = skuMoved && hasKeep(decision)
  const taken: ReadonlyArray<StaleAccept> = [
    ...A.map(A.filter(decision.accepted, stale), (field) => ({ rowId, field, kind: "accept" as const })),
    ...A.map(A.filter(decision.reverted, stale), (field) => ({ rowId, field, kind: "undo" as const })),
    ...O.match(storedBy, {
      onNone: A.empty,
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
 * field other than the SKU was matched again after the row's revision (`madeOn`, 0 when the request names none): one
 * question a row, however many fields moved. Only these need the file's review to settle; a SKU matched again takes
 * every one back without it.
 */
export const comparisonQuestions = (input: {
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly madeOn: Readonly<Record<string, number>>
  readonly set: SavedDecisions
}): ReadonlyArray<ComparisonQuestion> =>
  A.flatMap(R.toEntries(input.set), ([rowId, decision]) => {
    const made = madeOnOf(input.madeOn, rowId)
    const stale = matchedAfter(input)(made)
    if (StoredChoice.guards.undecided(decision.stored) || stale("sku")) return []
    const moved = A.filter(otherFields, (field) => stale(field))
    if (moved.length === 0) return []
    const now = judgeRow({ rowId, decision, stale, changed: () => false }).decision
    return [{ rowId, fields: A.map(moved, (field) => ({ field, made })), decided: made, then: decision, now }]
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
  // Looked up once a row: a file may have 50,000 of them.
  const changedKey = (row: { readonly rowId: string; readonly field: string }): string => `${row.field}:${row.rowId}`
  const changed = HashSet.fromIterable(A.map(input.changed, changedKey))
  const judged = R.map(input.set, (decision, rowId) =>
    judgeRow({
      rowId,
      decision,
      stale: matchedAfter(input)(madeOnOf(input.madeOn, rowId)),
      changed: (field) => HashSet.has(changed, changedKey({ rowId, field }))
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

const sameDifferences: {
  (a: ReadonlyArray<StoredDifference>, b: ReadonlyArray<StoredDifference>): boolean,
  (b: ReadonlyArray<StoredDifference>): (a: ReadonlyArray<StoredDifference>) => boolean
} = dual(2, (a: ReadonlyArray<StoredDifference>, b: ReadonlyArray<StoredDifference>): boolean =>
  a.length === b.length &&
  A.every(a, (one) =>
    A.some(b, (other) => other.field === one.field && other.stored === one.stored && other.file === one.file)
  ))

const sameComparison: {
  (a: O.Option<RowComparison>, b: O.Option<RowComparison>): boolean,
  (b: O.Option<RowComparison>): (a: O.Option<RowComparison>) => boolean
} = dual(2, (a: O.Option<RowComparison>, b: O.Option<RowComparison>): boolean =>
  O.isNone(a)
    ? O.isNone(b)
    : O.isSome(b) && a.value.reads === b.value.reads && sameDifferences(a.value.stored, b.value.stored)
)

// The decision as the row read before `field` was matched again, for that field only: what the re-match of another
// field takes back in any case is left out on both sides, so a change is told against this field alone.
const beforeOnly: {
  (question: ComparisonQuestion, field: Field): RowDecision,
  (field: Field): (question: ComparisonQuestion) => RowDecision
} = dual(2, (question: ComparisonQuestion, field: Field): RowDecision => ({
  ...question.now,
  accepted: A.filter(
    question.then.accepted,
    (accepted) => accepted === field || A.contains(question.now.accepted, accepted)
  ),
  reverted: A.filter(
    question.then.reverted,
    (reverted) => reverted === field || A.contains(question.now.reverted, reverted)
  )
}))

// A field and the column a comparison reads it from, whatever it reads now.
type Pin = { readonly field: Field; readonly column: O.Option<number> }
const pinsKey = (pins: ReadonlyArray<Pin>): string =>
  A.join(
    A.map(pins, (pin) => `${pin.field}:${String(pin.column)}`),
    ","
  )

/**
 * Of the questions (at most one a row), the rows whose comparison with their stored item changed because fields were
 * matched again. The row is judged as a whole: how it compares (whether it reads as an item, and every difference with
 * its stored text and file text) with every field matched again on the column it read when the decision was made, the
 * decision as made, against how it compares now. A row that read on one side and not on the other changed, whatever its
 * differences said; fields that each read the same column again changed nothing; a column not known (`columnAt` none)
 * counts as changed. Judged field by field with the others already moved, a row two moves stopped reading would look
 * unread on both sides of each. A changed row is named by the first field (in the item's order) whose own move, the
 * others as they read now, changes the comparison; by the first moved field when none does alone.
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
  const read = A.map(input.questions, (question) => ({
    question,
    moved: A.filter(
      A.map(question.fields, ({ field, made }) => ({ field, was: then(field, made) })),
      ({ field, was }) => !O.exists(was, (column) => sameColumn(column, now(field)))
    )
  }))
  const unknown = A.getSomes(
    A.map(read, ({ question, moved }) =>
      O.map(
        A.findFirst(moved, ({ was }) => O.isNone(was)),
        ({ field }): ComparisonChanged => ({ rowId: question.rowId, field })
      )
    )
  )
  const known = A.getSomes(
    A.map(read, ({ question, moved }) =>
      O.map(O.all(A.map(moved, ({ field, was }) => O.map(was, (column): Pin => ({ field, column })))), (pins) => ({
        question,
        pins
      }))
    )
  )
  const asked = A.filter(known, ({ pins }) => pins.length > 0)
  if (asked.length === 0) return unknown
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
  // Every field on the column it reads now, but those pinned to the column they read then.
  const pinned = (pins: ReadonlyArray<Pin>): ReadonlyArray<MappingChoice> =>
    A.map(fields, (field): MappingChoice => ({
      field,
      column: O.match(
        A.findFirst(pins, (pin) => pin.field === field),
        { onNone: () => now(field), onSome: (pin) => pin.column }
      ),
      by: "person",
      at: 0
    }))
  const nowComparison = comparisonOf(
    input.choices,
    R.fromEntries(A.map(asked, ({ question }) => [question.rowId, question.now] as const))
  )
  type Judged = { readonly question: ComparisonQuestion; readonly pins: ReadonlyArray<Pin> }
  // Of these rows, the ones that compare otherwise under their pins than now: one review for the rows pinned alike.
  const otherwise = (rows: ReadonlyArray<Judged>, decisionOfRow: (row: Judged) => RowDecision): ReadonlyArray<Judged> =>
    A.flatMap(R.values(A.groupBy(rows, ({ pins }) => pinsKey(pins))), (group) => {
      const thenComparison = comparisonOf(
        pinned(A.headNonEmpty(group).pins),
        R.fromEntries(A.map(group, (row) => [row.question.rowId, decisionOfRow(row)] as const))
      )
      return A.filter(
        group,
        ({ question }) => !sameComparison(thenComparison(question.rowId), nowComparison(question.rowId))
      )
    })
  const changed = otherwise(asked, ({ question }) => question.then)
  // Only to name a row two or more fields moved under: which of them changes the comparison alone.
  const alone = otherwise(
    A.flatMap(changed, ({ question, pins }) =>
      pins.length < 2 ? [] : A.map(pins, (pin) => ({ question, pins: [pin] }))
    ),
    ({ question, pins }) =>
      O.match(A.head(pins), { onNone: () => question.now, onSome: (pin) => beforeOnly(question, pin.field) })
  )
  // The pins of each row that changes it alone, by row: looked up once a row, however many rows there are.
  const aloneOf = A.groupBy(alone, ({ question }) => question.rowId)
  const named = A.getSomes(
    A.map(changed, ({ question, pins }) => {
      // The row judged alone, when it was: read as none or one list of judgements.
      const own = A.flatMap(
        O.match(R.get(aloneOf, question.rowId), { onNone: A.empty, onSome: identity }),
        (row) => row.pins
      )
      return O.map(
        O.orElse(
          A.findFirst(pins, (pin) => A.some(own, (one) => one.field === pin.field)),
          () => A.head(pins)
        ),
        ({ field }): ComparisonChanged => ({ rowId: question.rowId, field })
      )
    })
  )
  return [...unknown, ...named]
}

const ItemAsRead = S.Struct({
  id: ItemId.annotateKey({ description: "The stored item's id" }),
  revision: S.Int.annotateKey({ description: "The item's revision when the review read it" })
}).annotate({
  identifier: "ItemAsRead",
  description: "One stored item the review compared with, at the revision it read"
})

const CreatedAsRead = S.Struct({
  rowNumber: S.Int.annotateKey({
    description: "The file's row an earlier confirm of this import created an item from"
  }),
  part: S.Int.annotateKey({ description: "Which of the row's items it is, 0 when the row is one item" })
}).annotate({
  identifier: "CreatedAsRead",
  description: "One row of the file an earlier confirm of this import created an item from, as the review read it"
})

/**
 * Everything a question to the file's review was answered from, beyond the draft itself (a match's, a save's or a
 * confirm's judgement of a Replace or Keep-stored across a re-match): every SKU key it looked up and the items it found
 * under them, each at its revision; the rows an earlier confirm of the import created; and the import's suggestions.
 * None of them moves the draft's revision (an item is edited on the Items page or stocked by another import, a
 * take-back marks created rows, a request for suggestions stores some), so both stores write the match, the save and
 * the confirm only while all of them are still exactly these: a change in between makes the judgement be worked out
 * again, never written with take-backs judged against something that is no longer there. Not `asked`: the review was
 * not asked, nothing was read, and nothing is checked.
 */
export class ItemsAsRead extends S.Opaque<ItemsAsRead, { readonly brand: unique symbol }>()(
  S.Struct({
    asked: S.Boolean.annotateKey({
      description: "Whether the file's review was asked; when not, nothing was read and the write checks nothing"
    }),
    keys: S.Array(S.String).annotateKey({ description: "Every SKU key the review looked up, as `skuKey` makes them" }),
    items: S.Array(ItemAsRead).annotateKey({
      description: "Every item the organization had under those keys when the review read them"
    }),
    created: S.Array(CreatedAsRead).annotateKey({
      description: "Every row an earlier confirm of the import had created and still had when the review read them"
    }),
    suggestions: S.Array(SuggestionId).annotateKey({
      description: "Every suggestion stored for the import when the review read them"
    })
  }).annotate({
    identifier: "ItemsAsRead",
    description:
      "The stored items, created rows and suggestions a judgement of the decisions across a re-match was worked out from"
  })
) {
}

/** A judgement that did not ask the file's review: it read nothing, so nothing can overtake it. */
export const noItemsRead: ItemsAsRead = ItemsAsRead.make({
  asked: false,
  keys: [],
  items: [],
  created: [],
  suggestions: []
})

/**
 * Whether what a judgement read is still so: the organization's items (`items`, every one it has) under its keys are
 * exactly the items it found, each at the revision it found; the import's created rows (`created`) are the ones it
 * found; and its suggestions (`suggestions`) are the ones it found. The in-memory store's form of the check the D1
 * store makes in its write; true when nothing was read.
 *
 * @example stillAsRead(read)({ items: itemsNow, created: createdNow, suggestions: suggestionIdsNow }) // false once an item is edited
 */
export const stillAsRead =
  (read: ItemsAsRead) =>
    (now: {
      readonly items: ReadonlyArray<{ readonly id: string; readonly sku: string; readonly revision: number }>
      readonly created: ReadonlyArray<{ readonly rowNumber: number; readonly part: number }>
      readonly suggestions: ReadonlyArray<string>
    }): boolean => {
      if (!read.asked) return true
      const keys = HashSet.fromIterable(read.keys)
      const under = A.filter(now.items, (item) => HashSet.has(keys, skuKey(item)))
      const sameItems =
        under.length === read.items.length &&
        A.every(read.items, (seen) => A.some(under, (item) => item.id === seen.id && item.revision === seen.revision))
      const sameCreated =
        now.created.length === read.created.length &&
        A.every(read.created, (seen) =>
          A.some(now.created, (row) => row.rowNumber === seen.rowNumber && row.part === seen.part)
        )
      const sameSuggestions =
        now.suggestions.length === read.suggestions.length &&
        A.every(read.suggestions, (seen) => A.contains(now.suggestions, seen))
      return sameItems && sameCreated && sameSuggestions
    }

/** One question to the file's review, and whether one try of a request found the row's comparison changed. */
export type Answered = { readonly question: ComparisonQuestion; readonly changed: boolean }

/** Whether two decisions on a row say the same thing, field for field: the one comparison every caller uses. */
export const sameDecision: {
  (that: RowDecision): (self: RowDecision) => boolean
  (self: RowDecision, that: RowDecision): boolean
} = dual(2, S.toEquivalence(RowDecision))

// The same making of the same decision, asked about the same fields. Not the revision its columns are looked up on: a
// match judges every stored decision as made on the revision it read, which a save on any other row moves between two
// tries. A decision made again in between, even to the same choice, was made on what the row compares with by then: it
// is another question (`decided`).
const sameQuestion: {
  (a: ComparisonQuestion, b: ComparisonQuestion): boolean,
  (b: ComparisonQuestion): (a: ComparisonQuestion) => boolean
} = dual(2, (a: ComparisonQuestion, b: ComparisonQuestion): boolean =>
  a.rowId === b.rowId &&
  a.decided === b.decided &&
  a.fields.length === b.fields.length &&
  A.every(a.fields, ({ field }, index) => field === b.fields[index]?.field) &&
  sameDecision(a.then, b.then))

/**
 * The review's answer to one try of a request (a match, a save or a confirm worked out again because something it read
 * changed), held to what the earlier tries of the same request answered: a question asked before stands as taken back
 * only while every try found it so. A take-back comes from a column matched again after the decision, never from an
 * item stocked or edited, a created row or a suggestion that changed between two tries: those can drop a take-back an
 * earlier try found (what it rested on is gone), never add one. A question no earlier try asked (the row was decided
 * again in between, to another choice or to the same one) takes this try's answer. `answered` is what the next try is
 * held to.
 *
 * @example
 * // The first try found row 2's Replace standing (nothing stored under its SKU); an item stocked since makes the
 * // second try find it changed: it still stands.
 * answeredAcrossTries({ earlier: [{ question, changed: false }], questions: [question], changed: [{ rowId: "row-2", field: "unitCost" }] })
 * // { changed: [], answered: [{ question, changed: false }] }
 */
export const answeredAcrossTries = (input: {
  readonly earlier: ReadonlyArray<Answered>
  readonly questions: ReadonlyArray<ComparisonQuestion>
  readonly changed: ReadonlyArray<ComparisonChanged>
}): { readonly changed: ReadonlyArray<ComparisonChanged>; readonly answered: ReadonlyArray<Answered> } => {
  const changedRows = HashSet.fromIterable(A.map(input.changed, (row) => row.rowId))
  const now = A.map(input.questions, (question): Answered => {
    const found = HashSet.has(changedRows, question.rowId)
    const before = A.findFirst(input.earlier, (old) => sameQuestion(old.question, question))
    return { question, changed: O.match(before, { onNone: () => found, onSome: (old) => old.changed && found }) }
  })
  const kept = A.filter(input.earlier, (old) => !A.some(now, (answer) => sameQuestion(answer.question, old.question)))
  const standing = HashSet.fromIterable(
    A.map(
      A.filter(now, (answer) => answer.changed),
      (answer) => answer.question.rowId
    )
  )
  return {
    changed: A.filter(input.changed, (row) => HashSet.has(standing, row.rowId)),
    answered: [...kept, ...now]
  }
}

// Which columns a try was asked with: what every field reads, and every move that led there. Never the revisions, which
// a save on any row moves.
const ColumnsAsked = S.Struct({
  reads: S.Int.pipe(S.Option, S.Array).annotateKey({
    description: "The column every field reads, in the fields' order"
  }),
  moves: S.Array(ColumnMove.mapFields(Struct.pick(["field", "was", "column"]))).annotateKey({
    description: "Every move that led there: the field, the column it read before and the one it reads now"
  })
}).annotate({ description: "The columns a try was asked with" })
type ColumnsAsked = typeof ColumnsAsked.Type
const sameColumns = S.toEquivalence(ColumnsAsked)

/** A request's earlier tries, held: what they answered, and the columns they were asked with. */
export type HeldTries = { readonly columns: ColumnsAsked; readonly answered: ReadonlyArray<Answered> }

/**
 * One try of a match, a save or a confirm, held to its earlier tries only while it is asked with the same columns. A
 * save on another row between two tries moves the draft's revision (and with it the revisions a match stamps its own
 * choice and move with) and no column: the earlier answers are kept. When another person's match moved a column between
 * two tries, a take-back may be that column's, which is never held down by an answer given before it: the tries start
 * afresh. Otherwise as `answeredAcrossTries`: an item, a created row or a suggestion changed between two tries never
 * adds a take-back.
 *
 * @example
 * // Try 1 found row 3's Replace standing; Marcus re-matched Unit cost before try 2, which finds it changed: taken back.
 * heldToTries({ earlier: O.some(firstTry.held), head, choices: after, moves: [marcusMove, ownMove], questions, changed })
 */
export const heldToTries = (input: {
  readonly earlier: O.Option<HeldTries>
  readonly head: StagedHead
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly questions: ReadonlyArray<ComparisonQuestion>
  readonly changed: ReadonlyArray<ComparisonChanged>
}): { readonly changed: ReadonlyArray<ComparisonChanged>; readonly held: HeldTries } => {
  const columns: ColumnsAsked = {
    reads: A.map(fields, columnsOf({ head: input.head, choices: input.choices })),
    moves: input.moves
  }
  const earlier = O.match(
    O.filter(input.earlier, (held) => sameColumns(held.columns, columns)),
    { onNone: A.empty<Answered>, onSome: (held) => held.answered }
  )
  const kept = answeredAcrossTries({ earlier, questions: input.questions, changed: input.changed })
  return { changed: kept.changed, held: { columns, answered: kept.answered } }
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
export const noComparison: CompareAtMatch = () => Effect.succeed({ changed: [], read: noItemsRead })

// A row id's place in the file, for a `RowId` ("row-8", "row-8.2"): its row's number, then its part, a row of one item
// (no part) before its row's second item.
const placeInFile = (rowId: RowId): ReadonlyArray<number> =>
  A.map(Str.split(".")(Str.substring("row-".length)(rowId)), Number)
const fileOrder: Order.Order<RowId> = Order.mapInput(A.makeOrder(Order.Number), placeInFile)
const kindOrder = TakenBackKind.literals

/**
 * What one match took back, as the view names it: one entry per field that reads another column since (or none) and
 * kind (fields in the item's order, kinds as the screen names them), each with the revision the match wrote, who
 * matched, the field they picked a column for (`matched`), whether the entry's field reads a column after it (`reads`,
 * worked out from what the match leaves: `plan.reads`), how many rows and the first `takenBackRowsNamed` of them in the
 * file's order, each with the revision its stored decision was saved at as the match read it (`savedAt`): which
 * decision the part was taken from. A taken-back key that is not a row id is not counted, and a field and kind left
 * with no row has no entry.
 *
 * @example
 * takenBackOfMatch({ revision: 13, by: "Dana Whitfield", matched: "sku", reads: plan.reads, savedAt: { "row-4": 6, "row-9": 11 }, notApplied: [{ rowId: "row-9", field: "sku", kind: "stored" }, { rowId: "row-4", field: "sku", kind: "stored" }] })
 * // [{ revision: 13, by: "Dana Whitfield", field: "sku", matched: "sku", reads: true, kind: "stored", count: 2, rows: ["row-4", "row-9"], saved: { "row-4": 6, "row-9": 11 } }]
 */
export const takenBackOfMatch = (input: {
  readonly revision: number
  readonly by: string
  readonly matched: Field
  readonly reads: (field: Field) => boolean
  readonly savedAt: Readonly<Record<string, number>>
  readonly notApplied: ReadonlyArray<StaleAccept>
}): ReadonlyArray<MatchTakeBack> => {
  const isRowId = S.is(RowId)
  const groups = A.groupBy(input.notApplied, (taken) => `${taken.kind}:${taken.field}`)
  // In the item's order of fields, each field's kinds in their order: the order every screen names them in. A group of
  // a field the file has no such name for is no take-back anyone can be shown.
  return A.flatMap(fields, (field) =>
    A.flatMap(kindOrder, (kind) =>
      A.flatMap(A.fromOption(R.get(groups, `${kind}:${field}`)), (group): ReadonlyArray<MatchTakeBack> => {
        // Only rows the entry can name are counted, so `count` and `rows` always agree; a stored key that names no row
        // of a file is no row the screen can show.
        const rows = A.dedupe(
          A.filter(
            A.map(group, (taken) => taken.rowId),
            isRowId
          )
        )
        const named = A.take(A.sort(rows, fileOrder), takenBackRowsNamed)
        return A.isReadonlyArrayEmpty(rows)
          ? []
          : [
            {
              revision: input.revision,
              by: input.by,
              field,
              matched: O.some(input.matched),
              reads: O.some(input.reads(field)),
              kind,
              count: rows.length,
              rows: named,
              saved: O.some(
                R.fromEntries(
                  A.getSomes(
                    A.map(named, (rowId) => O.map(R.get(input.savedAt, rowId), (at) => [rowId, at] as const))
                  )
                )
              )
            }
          ]
      })
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
 * @example withTakeBacks({ kept: draftsEntries, added: takenBackOfMatch({ revision: 13, by, matched, reads, notApplied }) })
 */
export const withTakeBacks = (input: {
  readonly kept: ReadonlyArray<MatchTakeBack>
  readonly added: ReadonlyArray<MatchTakeBack>
}): ReadonlyArray<MatchTakeBack> => [...input.kept, ...input.added]

/**
 * One match worked out from a draft as it is stored: the choices it leaves, the moves it adds, and the stored decisions
 * it takes back, each judged as made on the revision before the match: the rows whose decision changes (`rewrites`), and
 * what was taken back by row, field and kind (`notApplied`). `reads` says whether a field reads a column after it.
 * `read` is the stored items the file's review answered from, when it was asked. `savedAt` is the revision each stored
 * decision was saved at, which tells one decided again between two tries from one that stood. Both stores write exactly
 * this, in one atomic write.
 *
 * The field's new choice is stamped `at`, the revision the match moves the draft to, when the field reads another
 * column by it. A person picking the column the field already reads (by its heading, or by an earlier pick) changes no
 * column: the choice keeps the stamp it had (0 when a heading read it), no move is added, and nothing is taken back, now
 * or at a later save or confirm of a decision made before (Benjamin, 2026-11-21, "Only when it changes").
 *
 * A stored Replace or Keep-stored on a field matched before moves were kept (`matchedUnkept`) was never judged against
 * that match, and which column it was made on is not stored: the first match that moves the field again takes it back
 * as not known and names it, one made after the old match and unchanged by this one too (Benjamin, 2026-11-21, "Take it
 * back, say so"). From then on the field's moves are kept.
 */
export const planMatch = Effect.fnUntraced(function* (input: {
  readonly head: StagedHead
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly decisions: SavedDecisions
  readonly savedAt: Readonly<Record<string, number>>
  readonly choice: { readonly field: Field; readonly column: O.Option<number> }
  readonly revision: number
  readonly compare: CompareAtMatch
}) {
  const { field, column } = input.choice
  const at = input.revision + 1
  const leaving = (stamp: number): ReadonlyArray<MappingChoice> => [
    ...A.filter(input.choices, (old) => old.field !== field),
    { field, column, by: "person", at: stamp }
  ]
  const added = movesOfMatch({ head: input.head, before: input.choices, after: leaving(at), kept: input.moves, at })
  const stamp = A.some(added, (move) => move.field === field)
    ? at
    : O.match(
      A.findFirst(input.choices, (old) => old.field === field),
      { onNone: () => stagedRevision, onSome: (old) => old.at }
    )
  const choices = leaving(stamp)
  const moves = [...input.moves, ...added]
  const madeOn = R.map(input.decisions, () => input.revision)
  const unkept = matchedUnkept(input)
  const questions = A.map(
    comparisonQuestions({ choices, moves, madeOn, set: input.decisions }),
    (question): ComparisonQuestion => ({
      ...question,
      decided: savedAtOf(input.savedAt, question.rowId),
      // Looked up on the revision before the match that kept no move, when one did not: that column is not known.
      fields: A.map(question.fields, (asked) =>
        O.match(unkept(asked.field), {
          onNone: () => asked,
          onSome: (knownFrom) => ({ ...asked, made: knownFrom - 1 })
        })
      )
    })
  )
  const compared: O.Option<Compared> =
    questions.length === 0 ? O.none() : yield* Effect.asSome(input.compare({ choices, moves, questions }))
  const changed = O.match(compared, { onNone: A.empty, onSome: (answer) => answer.changed })
  const { applied, notApplied } = withoutStaleDecisions({ choices, moves, madeOn, set: input.decisions, changed })
  const rewrites = R.filter(
    applied,
    (decision, rowId) => !O.exists(R.get(input.decisions, rowId), (old) => sameDecision(old, decision))
  )
  const columnNow = columnsOf({ head: input.head, choices })
  const reads = (moved: Field): boolean => O.isSome(columnNow(moved))
  return { at, choices, moves, rewrites, notApplied, reads, read: O.map(compared, (answer) => answer.read) }
})
