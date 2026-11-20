// Why a request about an import or an upload is refused, each with a sentence for the person.
import * as S from "effect/Schema"
import { reasonForPerson } from "../internal/Described.ts"
import { StaleAccept } from "./Decision.command.ts"

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
 * The confirm was made on an older draft than the one stored: somebody else decided a row or matched a column since
 * the screen that confirmed last read the import (storing a suggestion does not move the draft). Nothing was written, not an item and not
 * a decision: a confirm writes only what its screen showed. `revision` is where the draft is now, so the screen reads
 * the import again, shows what changed with its new totals, and the person confirms again.
 */
export class DraftMoved extends S.TaggedError<DraftMoved, { readonly brand: unique symbol }>()(
  "DraftMoved",
  {
    reason: reasonForPerson,
    revision: S.Int.annotateKey({ description: "The draft's revision now: later than the one the confirm named" })
  },
  {
    description:
      "The confirm named an older revision of the draft than the one stored: somebody changed the import since this screen read it. Nothing was written",
    httpApiStatus: 409
  }
) {}

/**
 * A save or a confirm named a revision of the draft the server has not reached: a `madeOn` of a row, or the confirm's
 * `revision`, later than the draft's. No screen of ours sends one; the server does not take the client's word for a
 * revision, so an accept cannot pass as made after a match it was made before. Nothing was written.
 */
export class RevisionAhead extends S.TaggedError<RevisionAhead, { readonly brand: unique symbol }>()(
  "RevisionAhead",
  {
    reason: reasonForPerson,
    revision: S.Int.annotateKey({ description: "The draft's revision now: the latest a request may name" })
  },
  {
    description:
      "A save or a confirm named a revision later than the draft's (a row's `madeOn`, or the confirm's `revision`). Nothing was written",
    httpApiStatus: 400
  }
) {}

/**
 * The confirm carried an accept made before its field's column was matched again: the proposal the person accepted
 * is no longer the one the row has, so confirming would import a row the screen does not show as it would be
 * written. Nothing was written. `accepts` names each such accept; the screen takes them back, shows the rows with
 * their proposals open, and the person confirms again.
 */
export class AcceptsTakenBack extends S.TaggedError<AcceptsTakenBack, { readonly brand: unique symbol }>()(
  "AcceptsTakenBack",
  {
    reason: reasonForPerson,
    accepts: S.Array(StaleAccept).annotateKey({
      description: "The accepts that were not applied, each by row and field"
    })
  },
  {
    description:
      "The confirm carried accepts made before their field's column was matched again. Nothing was written; `accepts` names them",
    httpApiStatus: 409
  }
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
