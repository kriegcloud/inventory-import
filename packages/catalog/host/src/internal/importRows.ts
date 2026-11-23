// What the import store's statements bind and read, as schemas a test can generate from: the store's statements are
// built inside its layer, so the shapes they encode live here. The one thing not to break: every moment is a
// `D1Instant`, so `createdAt < before` in SQL is a comparison in time, and every id is the brand the row holds.
import { D1Instant } from "@beep/d1/D1Instant"
import { ImportId, UploadKey } from "@inventory/catalog-contract/Ids"
import { ItemFields, skuKey } from "@inventory/catalog-contract/Item"
import { StagedHead } from "@inventory/catalog-contract/Staged"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
import * as Struct from "effect/Struct"
import { piece } from "./pieces.ts"

/** The staged file's head, as `importUpload.headJson` and `importDraft.headJson` hold it. */
export const HeadJson = S.fromJsonString(StagedHead)

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
  headJson: HeadJson,
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
