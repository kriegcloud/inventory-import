// What the import store's statements bind and read, as schemas a test can generate from: the store's statements are
// built inside its layer, so the shapes they encode live here. The one thing not to break: every moment is a
// `D1Instant`, so `createdAt < before` in SQL is a comparison in time, and every id is the brand the row holds.
import { D1Instant } from "@beep/d1/D1Instant"
import { ImportId, UploadKey } from "@inventory/catalog-contract/Ids"
import { ItemFields, skuKey } from "@inventory/catalog-contract/Item"
import {
  DecidedBy,
  maxReason,
  RowOutcome,
  decidedByNobody,
  decidedByPerson,
  outcomeOf
} from "@inventory/catalog-contract/Import"
import { StagedHeadJson } from "@inventory/catalog-contract/Staged"
import { said, saidParts } from "@inventory/catalog-model/CellReading"
import { PlannedRow } from "@inventory/catalog-model/Confirm"
import { DisplayName } from "@inventory/kernel/Text"
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
import * as Str from "effect/String"
import * as Struct from "effect/Struct"
import { piece } from "./pieces.ts"

/** Who is acting and where: every write is scoped to the actor's organization and names them in the audit line. */
export const Acting = { org: OrganizationId, actor: MemberId, name: S.String }

/**
 * A new upload as `importUpload` stores it: the id it is given, the browser's key for the file (a begin sent again
 * with the same key is the same upload), its head, how many rows and pieces will follow, and when it began.
 */
export const UploadInsert = S.Struct({
  ...Acting,
  id: ImportId,
  key: UploadKey,
  fileName: S.String,
  headJson: StagedHeadJson,
  rowCount: S.Int,
  chunkCount: S.Int,
  at: D1Instant
}).annotate({ description: "A new upload as importUpload stores it" })

/**
 * The cut-off of an organization's abandoned uploads: every upload begun before it, and its pieces, is deleted.
 * A moment, never text: `before: "9"` would sort after every stored moment and delete them all.
 */
export const AbandonedBefore = S.Struct({ org: OrganizationId, before: D1Instant }).annotate({
  description: "The moment before which an organization's unfinished uploads are deleted"
})

/** The number of a row of the file, from 1: the range `RowId` names. */
export const RowNumber = S.Int.check(S.isBetween({ minimum: 1, maximum: 9_999_999 })).annotate({
  description: "The number of a row of the file, from 1"
})

/** Which item of its row an item is: 0 for a row that is one item, else its part from 1, the range `RowId` names. */
export const Part = S.Int.check(S.isBetween({ minimum: 0, maximum: 9_999 })).annotate({
  description: "0 for a row that is one item, else which of its row's items, from 1"
})

const itemInsertFields = {
  ...ItemFields.fields,
  // A replace names its stored item by key, so its rows travel with no id of their own (""): an `ItemId` would
  // refuse them.
  id: S.String,
  rowNumber: RowNumber,
  part: Part
}

/**
 * An item a confirm writes, as the JSON one statement reads with json_each. Its `skuKey` is never given: it is
 * worked out from the SKU as the row is written, so the unique index compares the key the import compared.
 */
export const ItemInsert = S.Struct({ ...itemInsertFields, skuKey: S.String })
  .pipe(
    S.decodeTo(
      S.toType(S.Struct(itemInsertFields)),
      SchemaTransformation.transform({
        decode: Struct.omit(["skuKey"]),
        encode: (item) => ({ ...item, skuKey: skuKey(item) })
      })
    )
  )
  .annotate({ description: "An item a confirm writes, with the key its SKU is unique by" })

/** The items one confirm statement writes: a JSON array of one item or more, each with its key. */
export const ItemsPiece = piece(ItemInsert).annotate({ description: "Items a confirm writes, as one bound value" })

/**
 * Why a row was left out or found already there, as a confirm writes it: the plan's own reason, so the write asks
 * exactly what the plan holds (never empty, and within the model's bound on a reason) and no plan the review can make
 * is refused at the write. The result and the download of left-out rows read it back as `StoredReason` does: as
 * written when it fits, else with its long quoted values shortened.
 */
export const OutcomeReason = PlannedRow.cases.notImported.fields.reason

/**
 * Text cut to at most `max` UTF-16 units, the last of them "…" when anything was cut; never a character cut in two,
 * so a pair of surrogates is kept whole or left out.
 *
 * @example clipped("Packaging crates", 10) // "Packaging…"
 */
export const clipped: {
  (max: number): (text: string) => string
  (text: string, max: number): string
} = dual(2, (text: string, max: number): string => {
  if (text.length <= max) return text
  const kept = Str.takeLeft(text, max - 1)
  return `${/[\uD800-\uDBFF]$/.test(kept) ? Str.takeLeft(kept, max - 2) : kept}…`
})

// The sentences that quoted a whole cell, as every version before `said` wrote them (the review's messages, the same
// in each): a field's label at the start of a reason or after a stop and a space, a quote, the cell, a quote, and
// then one of the words that label took. Frozen: they are what is stored, not what the review says today.
const pastSentences: ReadonlyArray<readonly [label: string, after: ReadonlyArray<string>]> = [
  ["SKU", [" has spaces around it.", " is not three capital letters, a hyphen and four digits, like BLT-0042."]],
  ["Name", [" has spaces around it."]],
  ["Category", [" is not one of "]],
  ["Unit of measure", [" is not one of "]],
  ["Unit cost", [" is below zero.", " has more than 4 decimals.", " is not an amount in dollars written as digits."]],
  ["Quantity on hand", [" is not a whole number", " is below zero."]],
  ["Reorder point", [" is not a whole number", " is below zero."]],
  ["Active", [" is not true or false."]],
  ["Lot tracked", [" is not true or false."]],
  ["Tags", [" are not lower case, each once."]],
  ["First received", [" is not a day on the calendar", " is not written as year-month-day."]],
  ["Discontinued on", [" is not a day on the calendar", " is not written as year-month-day."]],
  ["Dimensions has the unit", [", not cm or in."]]
]

const literally = (text: string): string => Str.replaceAll(".", "\\.")(text)
// A reason whose every quote opens a cell after a past label or closes it before the words that label took: read so,
// no cell holds a quote, and the cells are exactly what stands between a quote and the next. Anchored at the start,
// and a cell or the text between two cells cannot hold a quote, so it is read once, in linear time.
const everyQuotePlaced = new RegExp(
  `^(?:[^"]*(?:^|\\. )(?:${A.join(
    A.map(pastSentences, ([label, after]) => `${label} "[^"]*"(?=${A.join(A.map(after, literally), "|")})`),
    "|"
  )}))*[^"]*$`
)

// The pairing read before, and the floor: a quote opens a cell after the start, a space or "(", and closes it before a
// space, a stop, a comma, a colon, ")" or the end; the cell runs to the last such closing quote before the next quote
// that only opens. So an inch mark (`12" pipe`) or a quote inside a word stays in its cell.
const quotedValue = /(?<=^|[\s(])"((?:(?!(?<=[\s(])"(?![\s.,;:)]|$))[\s\S])*)"(?=[\s.,;:)]|$)/

// How many of a cell's characters, from its start, `said` shows: all of a short one, the first ones of a long one.
const headOf = (cell: string): number => {
  const parts = saidParts(cell)
  return parts.length === "" ? parts.text.length : parts.text.length - 1
}

// A reason read with its cells where `separator` puts them (each odd part of the split), each said again as the
// review says one, and cut to the length the result reads. With its parts as they stand in the reason, and how many
// characters of each part, from its start, the cut text shows: of a cell, those after its opening quote.
const readWith = (
  reason: string,
  separator: string | RegExp
): { readonly text: string; readonly parts: ReadonlyArray<string>; readonly kept: ReadonlyArray<number> } => {
  const parts = Str.split(reason, separator)
  const shown = A.map(parts, (part, index) => (index % 2 === 1 ? said(part) : part))
  const whole = A.join(shown, "")
  const text = clipped(whole, maxReason)
  const room = whole.length <= maxReason ? whole.length : text.length - 1
  const kept = A.map(
    A.zip(
      parts,
      A.scan(shown, 0, (start, part) => start + part.length)
    ),
    ([part, start], index) =>
      index % 2 === 1
        ? Math.max(0, Math.min(headOf(part), room - start - 1))
        : Math.max(0, Math.min(part.length, room - start))
  )
  return { text, parts, kept }
}

const quotesIn = (text: string): number => Str.split(text, '"').length - 1

// Whether the exact reading shows every character of the reason the pairing shows, in a cell or out of one, quotes
// aside. A split takes one quote at each of its places, so a part starts after as many quotes as it has parts before
// it and those parts hold: what the pairing shows of a part, split at its own quotes, is the start of the exact parts
// from that one on, each but the last whole. The exact reading must show each of them at least as far.
const showsAllOf = (
  paired: { readonly parts: ReadonlyArray<string>; readonly kept: ReadonlyArray<number> },
  exact: { readonly kept: ReadonlyArray<number> }
): boolean =>
  A.every(
    A.zip(
      A.zip(paired.parts, paired.kept),
      A.scan(paired.parts, 0, (count, part) => count + quotesIn(part))
    ),
    ([[part, kept], held], index) =>
      A.every(Str.split(Str.slice(0, kept)(part), '"'), (piece, step) =>
        O.exists(A.get(exact.kept, index + held + step), (shown) => shown >= piece.length)
      )
  )

// Every version before `said` named a field's problem once in a reason (one problem a field), so an exact reading
// that quotes a label twice has read a cell's own text as a sentence.
const pastLabels = A.dedupe(A.map(pastSentences, ([label]) => label))
const labelBefore = new RegExp(`(?:^|\\. )(${A.join(pastLabels, "|")}) $`)
const eachLabelOnce = (parts: ReadonlyArray<string>): boolean => {
  const labels = A.getSomes(
    A.map(
      A.filter(parts, (_, index) => index % 2 === 0 && index < parts.length - 1),
      (part) => O.flatMap(Str.match(labelBefore)(part), (found) => A.get(found, 1))
    )
  )
  return HashSet.size(HashSet.fromIterable(labels)) === labels.length
}

/**
 * A past reason longer than the result reads, read again: its quoted cells each said as the review says one today
 * (`said`), a cell past `maxSaid` characters becoming its first ones and "…" with its length after the closing quote,
 * and the whole cut at its end to `maxReason`. It is read with its quotes paired by where they stand, as before. Where
 * every quote opens a cell after one of the past labels or closes it before the words that label took, it is also
 * read exactly, the cells being what stands between one quote and the next; that reading is taken only when it
 * names each label once and shows every character of the reason the pairing shows, in a cell or out of one, so no
 * reason says less of its problems than it did. Where the pairing is taken it keeps its gaps: a cell
 * holding a quote that opens a word of its own (`say "hi`) ends early, and the cell before one that starts with a
 * space or a stop can run into it. A cell whose own text is the end of one past sentence and the start of another,
 * with nothing else, reads the same either way, and is read as two. A long cell named without quotes (a vendor, a
 * SKU) is never shortened.
 *
 * @example pastReasonShortened(`Category "${"x".repeat(4000)}" is not one of the 5 categories.`)
 * // `Category "${"x".repeat(80)}…" (4,000 characters) is not one of the 5 categories.`
 */
export const pastReasonShortened = (reason: string): string => {
  const paired = readWith(reason, quotedValue)
  if (!everyQuotePlaced.test(reason)) return paired.text
  const exact = readWith(reason, '"')
  return eachLabelOnce(exact.parts) && showsAllOf(paired, exact) ? exact.text : paired.text
}

/**
 * A reason as `importOutcome` holds it, written by any version. A confirm today never writes one past `maxReason`
 * (`fitted` holds the plan to it), so it reads as written. One a past version wrote by quoting whole cells, and that
 * is longer, reads with its quoted values said again as the review says them, and is cut at its end only if it is
 * still too long, losing the problems past the cut: a past import's Result and download still answer. Encoding writes
 * it as it is.
 */
export const StoredReason = S.String.pipe(
  S.decodeTo(
    S.toType(S.String.check(S.isMaxLength(maxReason))),
    SchemaTransformation.transform({
      decode: (reason) => (reason.length <= maxReason ? reason : pastReasonShortened(reason)),
      encode: (reason) => reason
    })
  )
).annotate({ description: "A stored reason, its long quoted values shortened to fit the length the result reads" })

// Where the item is in the file and what it is called, as `importOutcome` keeps it.
const outcomePlace = { rowNumber: RowNumber, part: Part, sku: S.String, name: S.String }
// A row whose item was written: no reason, and nobody who decided it.
const noReason = { reason: S.Literal(""), decidedBy: S.Null, decidedByName: S.Null }
// A row that was already there: its reason, and nobody who decided it.
const alreadyReason = { reason: OutcomeReason, decidedBy: S.Null, decidedByName: S.Null }
// A row left out by a person, with the name they had then; or one nobody had settled.
const leftOutByPerson = { reason: OutcomeReason, decidedBy: S.Literal("person"), decidedByName: DisplayName }
const leftOutByNobody = { reason: OutcomeReason, decidedBy: S.Literal("nobody"), decidedByName: S.Null }

/**
 * The review's verdict on one item of the file, before the confirm knows whether its item landed. Its columns follow
 * its status: a row to write has no reason, every other row has one, and only a left-out row says who left it out.
 */
export const OutcomeInsert = S.Union([
  S.Struct({ ...outcomePlace, status: S.Literals(["ready", "update"]), ...noReason }),
  S.Struct({ ...outcomePlace, status: S.Literal("already"), ...alreadyReason }),
  S.Struct({ ...outcomePlace, status: S.Literal("notImported"), ...leftOutByPerson }),
  S.Struct({ ...outcomePlace, status: S.Literal("notImported"), ...leftOutByNobody })
]).annotate({ description: "The review's verdict on one row, before the confirm knows whether its item landed" })

/**
 * What the outcome rows store for a planned row: the reason of a row that is not written, and who left it out.
 *
 * @example outcomeInsertOf(plannedAlready) // { status: "already", reason: "SKU RJS-3545 is already there.", decidedBy: null, ... }
 */
export const outcomeInsertOf = (row: PlannedRow): typeof OutcomeInsert.Type => {
  const at = { rowNumber: row.rowNumber, part: row.part, sku: row.sku, name: row.name }
  const unsettled = { decidedBy: null, decidedByName: null }
  return PlannedRow.match(row, {
    ready: (): typeof OutcomeInsert.Type => ({ ...at, status: "ready", reason: "", ...unsettled }),
    update: (): typeof OutcomeInsert.Type => ({ ...at, status: "update", reason: "", ...unsettled }),
    already: (already): typeof OutcomeInsert.Type => ({
      ...at,
      status: "already",
      reason: already.reason,
      ...unsettled
    }),
    notImported: (out): typeof OutcomeInsert.Type =>
      DecidedBy.match(out.decidedBy, {
        person: (person): typeof OutcomeInsert.Type => ({
          ...at,
          status: "notImported",
          reason: out.reason,
          decidedBy: "person",
          decidedByName: person.name
        }),
        nobody: (): typeof OutcomeInsert.Type => ({
          ...at,
          status: "notImported",
          reason: out.reason,
          decidedBy: "nobody",
          decidedByName: null
        })
      })
  })
}

/**
 * What the confirms did with one item of the file, as `importOutcome` holds it, read as any version of the app wrote
 * it: the stored row is a boundary. A created, replaced or taken-back row holds no reason (`''`) and nobody; a reason
 * written before a rule on its form existed reads as it was written, a blank one too; and who decided is read as an
 * Option, so a row that names a person whose name is not one a person can read (from before names had a rule) says
 * nobody, as the result always said of it; a reason longer than the result reads is cut to it. The strict rules are on what is written (`OutcomeInsert`).
 */
export const OutcomeRow = S.Struct({
  ...outcomePlace,
  outcome: S.Literals(["created", "updated", "already", "notImported", "takenBack"]),
  reason: StoredReason,
  decidedBy: S.OptionFromNullOr(S.Literals(["person", "nobody"])),
  decidedByName: S.OptionFromNullOr(S.String)
}).annotate({ description: "What the confirms did with one item of the file, as stored by any version" })

/** The person a stored row names as having left it out: only when it says a person did, by a name a person can read. */
const leftOutBy = (row: typeof OutcomeRow.Type): O.Option<DisplayName> =>
  O.flatMap(
    O.filter(row.decidedBy, (who) => who === "person"),
    () => O.flatMap(row.decidedByName, S.decodeOption(DisplayName))
  )

/** What the result says of one stored outcome row: a person who left it out is named, else nobody decided. */
export const storedOutcome = (row: typeof OutcomeRow.Type): RowOutcome =>
  outcomeOf({
    rowNumber: row.rowNumber,
    // Stored as 0 for a row that is one item, which the answer leaves out.
    part: row.part === 0 ? O.none() : O.some(row.part),
    sku: row.sku,
    name: row.name,
    outcome: row.outcome,
    reason: row.reason,
    decidedBy: O.match(leftOutBy(row), { onNone: () => decidedByNobody, onSome: decidedByPerson })
  })
