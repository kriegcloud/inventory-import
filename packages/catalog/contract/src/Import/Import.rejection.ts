// Why a request about an import or an upload is refused, each with a sentence for the person.
import * as S from "effect/Schema"
import { reasonForPerson } from "../internal/Described.ts"

/** The import id in the address matches nothing in the caller's organization. */
export class ImportNotFound extends S.TaggedError<ImportNotFound, { readonly brand: unique symbol }>()(
  "ImportNotFound",
  { reason: reasonForPerson },
  { description: "The import id in the address matches nothing in the caller's organization", httpApiStatus: 404 }
) {}

/**
 * The column position in a match is not a column of the import's file. The screen offers only the file's own
 * columns, so this is a request no screen of ours sends: a request error, not a problem with the person's file.
 */
export class ColumnNotFound extends S.TaggedError<ColumnNotFound, { readonly brand: unique symbol }>()(
  "ColumnNotFound",
  { reason: reasonForPerson },
  { description: "The column position in a match is not a column of the import's file", httpApiStatus: 404 }
) {}

/** The import was already confirmed. A second confirm is refused instead of running again. */
export class AlreadyImported extends S.TaggedError<AlreadyImported, { readonly brand: unique symbol }>()(
  "AlreadyImported",
  { reason: reasonForPerson },
  { description: "The import was already confirmed: nothing was written", httpApiStatus: 409 }
) {}

/**
 * The import cannot be removed because it has already created items: it is confirmed, or it was confirmed once and
 * opened again to finish the rows it left out. Its items, its row-by-row result and the item of who decided each
 * changed value all point at it, so it stays. Only a file nobody has confirmed yet can be removed.
 */
export class ImportKept extends S.TaggedError<ImportKept, { readonly brand: unique symbol }>()(
  "ImportKept",
  { reason: reasonForPerson },
  {
    description:
      "The import cannot be removed because it has already created items: it is confirmed, or it was confirmed once and opened again to finish the rows it left out",
    httpApiStatus: 409
  }
) {}

/**
 * The upload id matches no unfinished upload of the caller: it was cancelled, it finished already, or it was left
 * for over an hour and deleted. The rows are not on the server; the file has to be chosen again.
 */
export class UploadNotFound extends S.TaggedError<UploadNotFound, { readonly brand: unique symbol }>()(
  "UploadNotFound",
  { reason: reasonForPerson },
  {
    description:
      "The upload id matches no unfinished upload of the caller: it was cancelled, it finished already, or it was left for over an hour and deleted",
    httpApiStatus: 404
  }
) {}
