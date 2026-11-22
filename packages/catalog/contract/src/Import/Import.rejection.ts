// Why a request about an import or an upload is refused, each with a sentence for the person.
import * as S from "effect/Schema"
import { reasonForPerson } from "../internal/Described.ts"
import { StaleAccept } from "./Decision.command.ts"
import { OrganizationId } from "@inventory/kernel/Ids"

/**
 * The import id in the address matches nothing in the caller's organization. `organizationId` is the organization the
 * server looked in, the caller's own: a tab whose session was switched to another organization elsewhere tells that
 * from an import that was removed, and erases nothing it keeps for the person on the first.
 */
export class ImportNotFound extends S.TaggedError<ImportNotFound, { readonly brand: unique symbol }>()(
  "ImportNotFound",
  {
    reason: reasonForPerson,
    organizationId: OrganizationId.annotateKey({ description: "The organization the server looked in: the caller's" })
  },
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
 * What a save, a confirm or a match was worked out against kept changing, under every try: nothing was written. It is the
 * import (a column matched, or, for a match and a save of rows that waited, any save), or what the judgement of a Replace
 * or Keep-stored across a re-match read beside it (a stored item edited, replaced, created or taken back, a row an
 * earlier confirm created, a suggestion stored), or both: `reason` says which. The same limit holds in every store; the
 * person tries again.
 */
export class DraftBusy extends S.TaggedError<DraftBusy, { readonly brand: unique symbol }>()(
  "DraftBusy",
  { reason: reasonForPerson },
  {
    description:
      "What the request was worked out against kept changing under every try: the import (a column matched, or, for a match and a save of rows that waited, any save), or the stored items, created rows or suggestions its judgement read. Nothing was written; `reason` says which",
    httpApiStatus: 409
  }
) {}

/**
 * The confirm carried a decision made before a column it rests on was matched again (judged row by row on its
 * `madeOn`): an accept or an undone fix of that field, a Replace, Keep-stored or keep-one-of-two after the SKU's
 * column, a Replace or Keep-stored whose row now compares otherwise after another column. Confirming would import a
 * row the screen does not show as it would be written. Nothing was written. `accepts` names each by row, field and
 * kind (the name is older than the kinds); the screen takes them back, shows the rows open again, and the person
 * confirms again.
 */
export class AcceptsTakenBack extends S.TaggedError<AcceptsTakenBack, { readonly brand: unique symbol }>()(
  "AcceptsTakenBack",
  {
    reason: reasonForPerson,
    accepts: S.Array(StaleAccept).annotateKey({
      description:
        "The decisions that would not be applied, each by row, field and kind (accept, stored, twin, undo), not only accepts"
    })
  },
  {
    description:
      "The confirm carried decisions made before a column they rest on was matched again: accepts, undone fixes, Replaces or Keep-storeds, keeps of one of two. Nothing was written; `accepts` names them",
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
