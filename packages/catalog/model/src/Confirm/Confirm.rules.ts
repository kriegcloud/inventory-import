// What a confirm will do with each item of a file, worked out from the review before anything is written. The one
// thing not to break: the plan is the review's verdict and nothing else. A row is planned as ready only where the
// review made an item for it, so the store can never be handed an item the screen refused.
import { Change, changeDecidedBy } from "@inventory/catalog-contract/Change"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { DecidedBy, decidedByNobody, decidedByPerson, maxReason } from "@inventory/catalog-contract/Import"
import { ItemFields } from "@inventory/catalog-contract/Item"
import { maxPart, RowNumber } from "@inventory/catalog-contract/Staged"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { DisplayName } from "@inventory/kernel/Text"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Tuple from "effect/Tuple"
import * as S from "effect/Schema"
import { saidParts } from "../Review/CellReading.rules.ts"
import { type Review, RowStatus, unreadReason } from "../Review/Review.rules.ts"
import { plural } from "../Words.rules.ts"

/** A value of a ready row that differs from its file, and who decided it when a person did. */
export class PlannedChange extends S.Opaque<PlannedChange, { readonly brand: unique symbol }>()(
  S.Struct({
    change: Change,
    decidedByName: S.Option(S.String).pipe(
      S.annotateKey({
        description: "Who accepted or typed the value; none when a rule applied it, or when no name is recorded"
      })
    )
  }).annotate({ identifier: "PlannedChange", description: "A changed value a confirm will record" })
) {}

/** The four things a confirm does with an item of the file. */
export const PlannedStatus = LiteralKit(["ready", "update", "already", "notImported"]).annotate({
  identifier: "PlannedStatus",
  description: "Create the item, replace the stored one, skip it as already there, or leave it out"
})
/** The decoded value of `PlannedStatus`. */
export type PlannedStatus = typeof PlannedStatus.Type

// Where the item is in the file, and what the file calls it. The row and the part are the ones the contract's row id
// is made of (`rowId`): a row of the file from 1 up, and a part that is 0 for a row of one item.
const place = {
  rowNumber: RowNumber.pipe(S.annotateKey({ description: "The row of the file" })),
  part: S.Int.check(S.isBetween({ minimum: 0, maximum: maxPart })).pipe(
    S.annotateKey({ description: "Which of its row's items it is: 0 when the row is one item" })
  ),
  sku: S.String.pipe(S.annotateKey({ description: "The row's SKU as the review reads it" })),
  name: S.String.pipe(S.annotateKey({ description: "The row's name as the review reads it" }))
}
/** The part a planned row of one item is written with: 0, the stored form's word for no part (`place.part`). */
const oneItemPart = 0

const written = {
  ...place,
  item: ItemFields,
  changes: S.Array(PlannedChange).pipe(
    S.annotateKey({ description: "The values that differ from the file, for the record of changed values" })
  )
}
// One sentence of a reason, and a whole reason: never blank, so a row that is left out or skipped always says why, in
// the result and in the download.
const Sentence = S.String.check(
  S.isMinLength(1),
  S.isPattern(/\S/, { expected: "a reason with at least one character that is not a space" })
)
const isSentence = S.is(Sentence)

// And never longer than the outcome rows store, so no plan holds a reason the store cannot write.
const reason = Sentence.check(S.isMaxLength(maxReason)).pipe(
  S.annotateKey({ description: "Every reason the row is not imported, joined: what the not-imported rows store" })
)

class PlannedReady extends S.Opaque<PlannedReady, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("ready"), ...written }).annotate({
    identifier: "PlannedReady",
    description: "The row becomes a new item"
  })
) {}

class PlannedUpdate extends S.Opaque<PlannedUpdate, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("update"), ...written }).annotate({
    identifier: "PlannedUpdate",
    description: "The row replaces the stored item with its SKU, as the person chose"
  })
) {}

class PlannedAlready extends S.Opaque<PlannedAlready, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("already"), ...place, reason }).annotate({
    identifier: "PlannedAlready",
    description: "The row says what is stored already: nothing is written for it"
  })
) {}

class PlannedNotImported extends S.Opaque<PlannedNotImported, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("notImported"), ...place, reason, decidedBy: DecidedBy }).annotate({
    identifier: "PlannedNotImported",
    description: "The row is left out: by the person, or because nobody settled it"
  })
) {}

/** What a confirm does with one item of the file, by `status`. */
export const PlannedRow = PlannedStatus.mapMembers(() =>
  Tuple.make(PlannedReady, PlannedUpdate, PlannedAlready, PlannedNotImported)
).pipe(
  S.annotate({ identifier: "PlannedRow", description: "What a confirm does with one item of the file" }),
  S.toTaggedUnion("status")
)
/** The decoded value of `PlannedRow`. */
export type PlannedRow = typeof PlannedRow.Type

/** Everything one confirm will do: the import it confirms, and its rows, one per item of the file. */
export class ConfirmPlan extends S.Opaque<ConfirmPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    draft: ImportId,
    rows: S.Array(PlannedRow)
  }).annotate({ identifier: "ConfirmPlan", description: "What one confirm will do with each item of a file" })
) {}

const notListed = (left: number): string => `${plural(left, "more problem is", "more problems are")} not listed here.`

/**
 * The most characters of one sentence a reason keeps whole when its sentences do not all fit. Far under `maxReason`,
 * so the first sentence is always said, whole or by its start.
 */
export const maxSentence = 600

/**
 * A row's reasons as the one reason a plan holds: joined by a space, and never past `maxReason` nor blank, whatever
 * the review said. The review keeps each sentence short (`said` in `CellReading.rules.ts`), so in practice they all
 * fit and the reason is every one of them; this holds the bound where the plan is made, so a confirm cannot fail on
 * the length of a reason. Where they do not all fit, a sentence longer than `maxSentence` is said by its start, ending
 * "…" (the start of the sentence, not of a value, so no length is given), and a sentence that would then still pass the
 * bound is left off, with every one after it, and the reason ends by saying how many.
 *
 * @example fitted(["Name is empty.", 'Category "Misc" is not one of the 5 categories.'])
 * // 'Name is empty. Category "Misc" is not one of the 5 categories.'
 */
export const fitted = (reasons: ReadonlyArray<string>): string =>
  A.match(A.filter(reasons, isSentence), {
    onEmpty: () => unreadReason,
    onNonEmpty: (sentences) => {
      const whole = A.join(sentences, " ")
      if (whole.length <= maxReason) return whole
      const short = A.map(sentences, (sentence) =>
        sentence.length <= maxSentence ? sentence : saidParts(sentence).text
      )
      const shortened = A.join(short, " ")
      if (shortened.length <= maxReason) return shortened
      // Some sentence is left off, so the reason ends with the count: its room is kept free of every sentence.
      const room = maxReason - notListed(short.length).length - 1
      const kept = A.reduce(short, { text: "", taken: 0, full: false }, (held, sentence, index) => {
        if (held.full) return held
        const next = held.text === "" ? sentence : `${held.text} ${sentence}`
        return next.length <= room ? { text: next, taken: index + 1, full: false } : { ...held, full: true }
      })
      return `${kept.text} ${notListed(short.length - kept.taken)}`
    }
  })

/** The rows of a plan that write an item: the new ones and the replacements. */
export const plannedItems = (
  plan: ConfirmPlan
): ReadonlyArray<Extract<PlannedRow, { readonly status: "ready" | "update" }>> =>
  A.filter(plan.rows, PlannedRow.isAnyOf(["ready", "update"]))

/**
 * The plan of a confirm, from the review as it stands. A ready row is created, or replaces the stored item when the
 * person chose that; a row already there is skipped; a row left out says who left it out (`authors` holds who
 * decided each row), and a row still waiting says nobody settled it. A decision nobody is recorded for, or whose
 * stored name is too long or empty to show, names no one: the person who confirms is never named in their place
 * (Benjamin, 2026-11-26).
 */
export const confirmPlan = (input: {
  readonly draft: ImportId
  readonly review: Review
  readonly authors: Readonly<Record<string, string>>
}): ConfirmPlan => {
  const { review, authors } = input
  const who = (rowId: string): O.Option<DisplayName> => O.flatMap(R.get(authors, rowId), S.decodeOption(DisplayName))
  const rows = A.map(review.rows, (row): PlannedRow => {
    const at = {
      rowNumber: row.rowNumber,
      part: O.match(row.part, { onNone: () => oneItemPart, onSome: (part) => part.number }),
      sku: row.values.sku,
      name: row.values.name
    }
    // Every problem of the row, so the not-imported rows and their download name each one.
    const why = fitted(row.reasons)
    if (RowStatus.is.ready(row.status) && O.isSome(row.item)) {
      const made = {
        ...at,
        item: row.item.value,
        changes: A.map(row.changes, (change) =>
          PlannedChange.make({
            change,
            decidedByName: changeDecidedBy(change) === "person" ? who(row.id) : O.none()
          })
        )
      }
      return row.update ? PlannedUpdate.make(made) : PlannedReady.make(made)
    }
    if (RowStatus.is.already(row.status)) return PlannedAlready.make({ ...at, reason: why })
    return PlannedNotImported.make({
      ...at,
      reason: why,
      decidedBy: RowStatus.is.out(row.status) ? decidedByPerson(who(row.id)) : decidedByNobody
    })
  })
  return ConfirmPlan.make({ draft: input.draft, rows })
}
