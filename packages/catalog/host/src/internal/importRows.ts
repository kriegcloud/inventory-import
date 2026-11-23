// What the import store's statements bind and read, as schemas a test can generate from: the store's statements are
// built inside its layer, so the shapes they encode live here. The one thing not to break: every moment is a
// `D1Instant`, so `createdAt < before` in SQL is a comparison in time, and every id is the brand the row holds.
import { D1Instant } from "@beep/d1/D1Instant"
import { ImportId, UploadKey } from "@inventory/catalog-contract/Ids"
import { StagedHead } from "@inventory/catalog-contract/Staged"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import * as S from "effect/Schema"

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
