// What the import store's statements bind and read, as schemas a test can generate from: the store's statements are
// built inside its layer, so the shapes they encode live here. The one thing not to break: every moment is a
// `D1Instant`, so `createdAt < before` in SQL is a comparison in time, and every id is the brand the row holds.
import { D1Instant } from "@beep/d1/D1Instant"
import { ImportId, UploadKey } from "@inventory/catalog-contract/Ids"
import { ItemFields, skuKey } from "@inventory/catalog-contract/Item"
import { DecidedBy, RowOutcome, decidedByNobody, decidedByPerson, outcomeOf } from "@inventory/catalog-contract/Import"
import { StagedHeadJson } from "@inventory/catalog-contract/Staged"
import { PlannedRow } from "@inventory/catalog-model/Confirm"
import { DisplayName } from "@inventory/kernel/Text"
import * as O from "effect/Option"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
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
 * Why a row was left out or found already there, as a confirm writes it: never empty, as the plan's reason never is,
 * and at most the 4,000 characters the result reads. It asks no more of a reason than the plan does, so no plan the
 * review can make is refused at the write; the result and the download of left-out rows show it as it is.
 */
export const OutcomeReason = S.String.check(S.isMinLength(1), S.isMaxLength(4000)).annotate({
  description: "Why a row was left out or already there, one sentence per problem"
})

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
 * nobody, as the result always said of it. The strict rules are on what is written (`OutcomeInsert`).
 */
export const OutcomeRow = S.Struct({
  ...outcomePlace,
  outcome: S.Literals(["created", "updated", "already", "notImported", "takenBack"]),
  reason: S.String.check(S.isMaxLength(4000)),
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
